import Observation
import SwiftUI

enum AppTab: Hashable { case groups, notifications, profile }

/// Navigasjonsmål i flokk-fanen.
enum Route: Hashable {
    case group(FlokkGroup)
    case event(UUID)
    case chat(groupId: UUID, eventId: UUID?)
}

@Observable
final class Router {
    static let shared = Router()

    var tab: AppTab = .groups
    var path: [Route] = []
    /// Invitasjon som venter på å bli godtatt (fra lenke)
    var invitationToken: String?
    /// Øker når flokklisten bør lastes på nytt (ny flokk, utmelding)
    var groupsVersion = 0
    /// Chatten som vises nå (for å ikke vise banner for den)
    var visibleChat: (groupId: UUID, eventId: UUID?)?

    func isViewing(_ target: PushTarget?) -> Bool {
        guard let target, target.isMessage, let chat = visibleChat else { return false }
        return chat.groupId == target.groupId && chat.eventId == target.eventId
    }

    /// Lenker fra web (Universal Links) eller flokk://-adresser:
    ///   /invitasjon/<token>, /<slug>, /<slug>/arrangement/<id>
    func handle(url: URL) {
        let parts: [String]
        if url.scheme == "flokk" {
            parts = ([url.host()].compactMap { $0 } + url.pathComponents).filter { $0 != "/" && !$0.isEmpty }
        } else {
            parts = url.pathComponents.filter { $0 != "/" && !$0.isEmpty }
        }
        guard let first = parts.first else { return }
        if first == "invitasjon", parts.count > 1 {
            invitationToken = parts[1]
            return
        }
        Task {
            let group: FlokkGroup? = try? await supabase.from("groups")
                .select("id, slug, name, description, visibility, tint, backdrop, emoji")
                .eq("slug", value: first).single().decoded()
            guard let group else { return }
            var next: [Route] = [.group(group)]
            if parts.count > 2, parts[1] == "arrangement", let id = UUID(uuidString: parts[2]) { next.append(.event(id)) }
            tab = .groups
            path = next
        }
    }

    /// Åpner flokken (og ev. arrangement/chat) som varselet gjelder.
    func open(_ target: PushTarget) {
        Task {
            let group: FlokkGroup? = try? await supabase.from("groups")
                .select("id, slug, name, description, visibility, tint, backdrop, emoji")
                .eq("id", value: target.groupId).single().decoded()
            guard let group else { return }
            var next: [Route] = [.group(group)]
            if let e = target.eventId { next.append(.event(e)) }
            if target.isMessage { next.append(.chat(groupId: group.id, eventId: target.eventId)) }
            tab = .groups
            path = next
        }
    }
}
