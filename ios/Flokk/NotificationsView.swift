import Observation
import Supabase
import SwiftUI

struct AppNotification: Decodable, Identifiable, Equatable {
    struct NData: Decodable, Equatable {
        let title: String?
        let startsAt: String?
        let task: String?
        let preview: String?
    }
    struct GroupRef: Decodable, Equatable { let id: UUID; let name: String; let emoji: String? }
    struct Actor: Decodable, Equatable { let displayName: String }

    let id: UUID
    let kind: String
    let count: Int
    let data: NData
    let readAt: String?
    let updatedAt: String
    let eventId: UUID?
    let group: GroupRef?
    let actor: Actor?

    var isUnread: Bool { readAt == nil }

    /// Samme tekster som webappen (describeNotification).
    var text: String {
        let who = actor.map { $0.displayName.isEmpty ? "Noen" : $0.displayName } ?? "Noen"
        let title = data.title.map { "«\($0)»" } ?? "arrangementet"
        let when = data.startsAt.map(Fmt.dateTime) ?? ""
        switch kind {
        case "event_created": return "\(who) har laget \(title). Stem på tidspunkt!"
        case "time_suggested":
            return count > 1 ? "\(count) nye forslag til tidspunkt for \(title)" : "\(who) foreslo \(when) for \(title)"
        case "vote": return count > 1 ? "\(count) nye stemmer på \(title)" : "\(who) har stemt på \(title)"
        case "time_chosen": return "\(title) er satt til \(when)"
        case "event_cancelled": return "\(title) er avlyst"
        case "task_assigned": return "\(who) ga deg oppgaven «\(data.task ?? "")» til \(title)"
        case "message":
            let whereText = data.title.map { "«\($0)»" } ?? "gruppechatten"
            return count > 1 ? "\(count) nye meldinger i \(whereText)" : "\(who) i \(whereText): \(data.preview ?? "")"
        default: return "Noe nytt har skjedd i flokken"
        }
    }

    var symbol: String {
        switch kind {
        case "message": "bubble.left.fill"
        case "vote": "hand.thumbsup.fill"
        case "time_suggested": "clock.fill"
        case "time_chosen": "calendar.badge.checkmark"
        case "event_cancelled": "calendar.badge.minus"
        case "task_assigned": "checklist"
        default: "calendar.badge.plus"
        }
    }
}

/// Varsler for innlogget bruker, med ulest-teller som også settes på app-ikonet.
@Observable
final class NotificationCenterModel {
    static let shared = NotificationCenterModel()

    private(set) var items: [AppNotification] = []
    private(set) var loaded = false
    var unread: Int { items.filter(\.isUnread).count }
    private var channel: RealtimeChannelV2?

    func load() async {
        let rows: [AppNotification]? = try? await supabase.from("notifications")
            .select("id, kind, count, data, read_at, updated_at, event_id, group:groups(id, name, emoji), actor:profiles!notifications_actor_id_fkey(display_name)")
            .order("updated_at", ascending: false)
            .limit(50)
            .decoded()
        if let rows { items = rows }
        loaded = true
        PushManager.shared.setBadge(unread)
    }

    func bump() { Task { await load() } }

    /// Oppdaterer listen når nye varsler lages eller samles opp.
    func listen(userId: UUID) async {
        guard channel == nil else { return }
        let ch = supabase.channel("notifications:\(userId.uuidString.lowercased())")
        let changes = ch.postgresChange(AnyAction.self, schema: "public", table: "notifications", filter: .eq("user_id", value: userId))
        channel = ch
        try? await ch.subscribeWithError()
        for await _ in changes { await load() }
    }

    func stop() async {
        if let channel { await supabase.removeChannel(channel) }
        channel = nil
        items = []
        PushManager.shared.setBadge(0)
    }

    func markRead(_ n: AppNotification) async {
        guard n.isUnread else { return }
        _ = try? await supabase.from("notifications")
            .update(["read_at": ISO8601DateFormatter().string(from: .now)])
            .eq("id", value: n.id).execute()
        await load()
    }

    func markAllRead() async {
        _ = try? await supabase.from("notifications")
            .update(["read_at": ISO8601DateFormatter().string(from: .now)])
            .is("read_at", value: nil).execute()
        await load()
    }
}

struct NotificationsView: View {
    @State private var model = NotificationCenterModel.shared
    @Environment(PushManager.self) private var push

    var body: some View {
        NavigationStack {
            List {
                if push.status == .notDetermined || push.status == .denied {
                    Section { PushPrompt() }
                }
                if model.loaded && model.items.isEmpty {
                    ContentUnavailableView("Ingen varsler", systemImage: "bell", description: Text("Her ser du nye arrangementer, stemmer og meldinger."))
                        .listRowBackground(Color.clear)
                }
                ForEach(model.items) { n in
                    Button {
                        Task { await model.markRead(n) }
                        if let g = n.group?.id {
                            Router.shared.open(PushTarget(groupId: g, eventId: n.eventId, isMessage: n.kind == "message"))
                        }
                    } label: { row(n) }
                    .buttonStyle(.plain)
                    .listRowBackground(n.isUnread ? Color.accentColor.opacity(0.06) : Color(.secondarySystemGroupedBackground))
                }
            }
            .navigationTitle("Varsler")
            .toolbar {
                if model.unread > 0 {
                    Button("Merk alle som lest") { Task { await model.markAllRead() } }
                }
            }
            .refreshable { await model.load() }
            .task { await model.load() }
        }
    }

    private func row(_ n: AppNotification) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: n.symbol)
                .font(.system(size: 15))
                .frame(width: 34, height: 34)
                .background(Tint.color("mint"), in: .circle)
            VStack(alignment: .leading, spacing: 3) {
                if let g = n.group {
                    Text([g.emoji, g.name].compactMap { $0 }.joined(separator: " "))
                        .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                }
                Text(n.text).font(.subheadline.weight(n.isUnread ? .semibold : .regular))
                if let d = Fmt.date(n.updatedAt) {
                    Text(d, format: .relative(presentation: .named)).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
            if n.isUnread {
                Circle().fill(Color.accentColor).frame(width: 9, height: 9).padding(.top, 6)
                    .accessibilityLabel("ulest")
            }
        }
        .padding(.vertical, 4)
        .contentShape(.rect)
    }
}

/// Myk forespørsel før systemdialogen – og hjelp hvis varsler er slått av.
struct PushPrompt: View {
    @Environment(PushManager.self) private var push

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Få beskjed når noe skjer", systemImage: "bell.badge.fill").font(.headline)
            if push.status == .denied {
                Text("Varsler er slått av for Flokk. Slå dem på i Innstillinger for å få beskjed om nye arrangementer, stemmer og meldinger.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button("Åpne Innstillinger") {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { UIApplication.shared.open(url) }
                }
                .buttonStyle(.bordered)
            } else {
                Text("Varsler om nye arrangementer, tidspunkt som blir valgt og nye meldinger i flokkene dine.")
                    .font(.subheadline).foregroundStyle(.secondary)
                Button("Slå på varsler") { Task { await push.requestPermission() } }
                    .prominentButton()
            }
        }
        .padding(.vertical, 6)
    }
}
