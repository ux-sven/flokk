import Foundation

struct FlokkGroup: Decodable, Identifiable, Hashable {
    let id: UUID
    let slug: String
    let name: String
    let description: String?
    let visibility: String
    let tint: String?
    let backdrop: String?
    let emoji: String?
}

struct Membership: Decodable {
    let role: String
    let groups: FlokkGroup?
}

struct Profile: Decodable, Hashable {
    let id: UUID
    let displayName: String
    let avatarUrl: String?
}

struct Member: Decodable, Identifiable, Hashable {
    let userId: UUID
    let role: String
    let profiles: Profile?
    var id: UUID { userId }
    var name: String { (profiles?.displayName).flatMap { $0.isEmpty ? nil : $0 } ?? "Medlem" }
}

struct EventSummary: Decodable, Identifiable, Hashable {
    struct Chosen: Decodable, Hashable { let startsAt: String }
    let id: UUID
    let title: String
    let status: String
    let location: String?
    let backdrop: String?
    let chosen: Chosen?
}

struct EventDetail: Decodable, Identifiable {
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
}

enum VoteAnswer: String, Codable, CaseIterable {
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

struct Vote: Codable, Hashable {
    let optionId: UUID
    let userId: UUID
    let answer: VoteAnswer
}

struct TimeOption: Decodable, Identifiable {
    let id: UUID
    let startsAt: String
    let createdBy: UUID?
    var eventVotes: [Vote]
}

struct Message: Decodable, Identifiable, Equatable {
    let id: UUID
    let groupId: UUID
    let eventId: UUID?
    let authorId: UUID
    let body: String
    let createdAt: String
}
