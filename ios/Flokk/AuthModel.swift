import Foundation
import Observation
import Supabase

@Observable
final class AuthModel {
    private(set) var userId: UUID?
    private(set) var email: String?
    private(set) var isLoading = true

    init() {
        Task { await listen() }
    }

    private func listen() async {
        for await (_, session) in supabase.auth.authStateChanges {
            // Utløpt lokal økt regnes som utlogget til den er fornyet
            if let session, !session.isExpired {
                userId = session.user.id
                email = session.user.email
            } else if session == nil {
                userId = nil
                email = nil
            }
            isLoading = false
        }
    }

    func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    func signOut() async {
        try? await supabase.auth.signOut()
    }
}
