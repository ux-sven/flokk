import Foundation
import Observation
import Supabase

/// Samme presence-kanal som webappen («presence:group:<id>», nøkkel = bruker-id),
/// så web og app ser hverandre.
@Observable
final class PresenceModel {
    private(set) var online: Set<UUID> = []
    private var channel: RealtimeChannelV2?
    private var listener: Task<Void, Never>?

    func start(groupId: UUID, userId: UUID) async {
        guard channel == nil else { return }
        let key = userId.uuidString.lowercased()
        let ch = supabase.channel("presence:group:\(groupId.uuidString.lowercased())") {
            $0.presence.key = key
        }
        channel = ch
        online.insert(userId)
        let stream = ch.presenceChange()
        listener = Task { [weak self] in
            for await action in stream {
                guard let self else { return }
                for k in action.joins.keys { if let id = UUID(uuidString: k) { self.online.insert(id) } }
                for k in action.leaves.keys { if let id = UUID(uuidString: k), id != userId { self.online.remove(id) } }
            }
        }
        do {
            try await ch.subscribeWithError()
            try await ch.track(["since": ISO8601DateFormatter().string(from: .now)])
        } catch {
            // Uten sanntid vises bare egen status
        }
    }

    func stop() async {
        listener?.cancel()
        listener = nil
        if let channel { await supabase.removeChannel(channel) }
        channel = nil
    }
}
