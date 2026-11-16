import SwiftUI

struct GroupView: View {
    let group: FlokkGroup
    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    @State private var events: [EventSummary] = []
    @State private var members: [Member] = []
    @State private var presence = PresenceModel()

    private var othersOnline: [Member] {
        members.filter { $0.userId != auth.userId && presence.online.contains($0.userId) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                if !othersOnline.isEmpty { OnlineNowRow(people: othersOnline) }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Arrangementer").font(.title2.bold())
                    if events.isEmpty {
                        Text("Ingen arrangementer ennå.")
                            .foregroundStyle(.secondary)
                            .padding(20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card()
                    }
                    ForEach(events) { e in
                        NavigationLink(value: e) { EventCard(event: e) }.buttonStyle(.plain)
                    }
                }

                NavigationLink {
                    ChatView(groupId: group.id, eventId: nil, title: "Gruppechat", names: names)
                } label: {
                    Label("Gruppechat", systemImage: "bubble.left.and.bubble.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                        .card()
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Medlemmer · \(members.count)").font(.title3.bold())
                    ForEach(members) { m in
                        HStack(spacing: 12) {
                            AvatarView(name: m.name, url: m.profiles?.avatarUrl, online: presence.online.contains(m.userId))
                            Text(m.name + (m.userId == auth.userId ? " (deg)" : "")).font(.subheadline.weight(.medium))
                            Spacer()
                            if let role = roleLabel(m.role) {
                                Text(role).font(.caption.weight(.medium))
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(.quaternary, in: .capsule)
                            }
                        }
                    }
                }
                .padding(20)
                .card()
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(group.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ShareLink(item: siteURL("/\(group.slug)")) { Image(systemName: "link") }
                .accessibilityLabel("Del lenke til flokken")
        }
        .refreshable { await load() }
        .task { await load() }
        .task(id: scenePhase) {
            guard let uid = auth.userId else { return }
            if scenePhase == .active { await presence.start(groupId: group.id, userId: uid) } else { await presence.stop() }
        }
        .onDisappear { Task { await presence.stop() } }
    }

    private var names: [UUID: String] { Dictionary(uniqueKeysWithValues: members.map { ($0.userId, $0.name) }) }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(group.emoji ?? "🪺").font(.system(size: 48))
            Text(group.name).font(.largeTitle.bold())
            HStack(spacing: 4) {
                Image(systemName: group.visibility == "open" ? "globe" : "lock")
                Text(group.visibility == "open" ? "Åpen" : "Kun inviterte")
            }
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(.thinMaterial, in: .capsule)
            if let d = group.description, !d.isEmpty { Text(d).opacity(0.8) }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { Surface(backdrop: group.backdrop, tint: group.tint) }
        .clipShape(.rect(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
    }

    private func roleLabel(_ r: String) -> String? {
        switch r { case "owner": "Eier"; case "admin": "Admin"; default: nil }
    }

    private func load() async {
        async let ev: [EventSummary] = supabase
            .from("events")
            .select("id, title, status, location, backdrop, chosen:event_time_options!events_chosen_option_fk(starts_at)")
            .eq("group_id", value: group.id)
            .neq("status", value: "cancelled")
            .is("archived_at", value: nil)
            .order("created_at", ascending: false)
            .decoded()
        async let mem: [Member] = supabase
            .from("group_members")
            .select("user_id, role, profiles(id, display_name, avatar_url)")
            .eq("group_id", value: group.id)
            .order("joined_at")
            .decoded()
        if let e = try? await ev { events = e }
        if let m = try? await mem { members = m }
    }
}

struct EventCard: View {
    let event: EventSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let b = event.backdrop, knownBackdrops.contains(b) {
                Surface(backdrop: b, tint: nil).frame(height: 64).clipped()
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(event.chosen.map { Fmt.dateTime($0.startsAt) } ?? "Stemming pågår")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
                Text(event.title).font(.headline)
                if let l = event.location { Text(l).font(.caption).foregroundStyle(.secondary) }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .clipShape(.rect(cornerRadius: 24))
    }
}

struct OnlineNowRow: View {
    let people: [Member]

    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(.green).frame(width: 9, height: 9)
            HStack(spacing: -8) {
                ForEach(people.prefix(5)) { AvatarView(name: $0.name, url: $0.profiles?.avatarUrl, size: 26) }
            }
            Text(label).font(.subheadline.weight(.medium)).lineLimit(1)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color.green.opacity(0.12), in: .capsule)
        .accessibilityElement(children: .combine)
    }

    private var label: String {
        switch people.count {
        case 1: "\(people[0].name) er også inne nå"
        case 2: "\(people[0].name) og \(people[1].name) er også inne nå"
        default: "\(people[0].name) og \(people.count - 1) andre er også inne nå"
        }
    }
}
