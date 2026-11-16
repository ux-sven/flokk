import Foundation

nonisolated struct FlokkGroup: Decodable, Identifiable, Hashable {
    let id: UUID
    let slug: String
    let name: String
    let description: String?
    let visibility: String
    let tint: String?
    let backdrop: String?
    let emoji: String?
}

nonisolated struct Membership: Decodable {
    let role: String
    let groups: FlokkGroup?
}

nonisolated struct Profile: Decodable, Hashable {
    let id: UUID
    let displayName: String
    let avatarUrl: String?
}

nonisolated struct Member: Decodable, Identifiable, Hashable {
    let userId: UUID
    let role: String
    let profiles: Profile?
    var id: UUID { userId }
    var name: String { (profiles?.displayName).flatMap { $0.isEmpty ? nil : $0 } ?? "Medlem" }
}

nonisolated struct EventSummary: Decodable, Identifiable, Hashable {
    struct Chosen: Decodable, Hashable { let startsAt: String }
    let id: UUID
    let title: String
    let status: String
    let location: String?
    let backdrop: String?
    let createdAt: String?
    let chosen: Chosen?

    var startsAt: Date? { chosen.flatMap { Fmt.date($0.startsAt) } }
}

/// Arrangementer delt i «Kommende» (snarest først), «Stemming pågår» (nyeste først)
/// og «Tidligere» (sist passerte først). Uten sluttid regnes et arrangement som
/// kommende til seks timer etter start – samme regel som webappen.
nonisolated struct EventSections {
    static let pastAfter: TimeInterval = 6 * 60 * 60
    var upcoming: [EventSummary] = []
    var voting: [EventSummary] = []
    var past: [EventSummary] = []

    init(_ events: [EventSummary], now: Date = .now) {
        for e in events {
            guard let at = e.startsAt else { voting.append(e); continue }
            if at.addingTimeInterval(Self.pastAfter) < now { past.append(e) } else { upcoming.append(e) }
        }
        upcoming.sort { $0.startsAt! < $1.startsAt! }
        past.sort { $0.startsAt! > $1.startsAt! }
        voting.sort { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }
}

nonisolated struct EventDetail: Decodable, Identifiable {
    let id: UUID
    let title: String
    let description: String
    let location: String?
    let locationLat: Double?
    let locationLng: Double?
    let backdrop: String?
    let status: String
    let chosenOptionId: UUID?
    let createdBy: UUID
    let allowTimeSuggestions: Bool?
    let archivedAt: String?
}

nonisolated struct EventTask: Decodable, Identifiable, Equatable {
    let id: UUID
    let title: String
    let assigneeId: UUID?
    let status: String
    let createdBy: UUID?
    var isDone: Bool { status == "done" }
}

nonisolated enum VoteAnswer: String, Codable, CaseIterable {
    case yes, maybe, no

    var label: String {
        switch self {
        case .yes: "Passer"
        case .maybe: "Kanskje"
        case .no: "Passer ikke"
        }
    }

    var symbol: String {
        switch self {
        case .yes: "checkmark"
        case .maybe: "questionmark"
        case .no: "xmark"
        }
    }
}

nonisolated struct Vote: Codable, Hashable {
    let optionId: UUID
    let userId: UUID
    let answer: VoteAnswer
}

nonisolated struct TimeOption: Decodable, Identifiable {
    let id: UUID
    let startsAt: String
    let createdBy: UUID?
    var eventVotes: [Vote]
}

nonisolated struct Message: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupId: UUID
    let eventId: UUID?
    let authorId: UUID
    let body: String
    let createdAt: String
}
