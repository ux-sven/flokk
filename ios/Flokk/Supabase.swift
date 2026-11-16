import Foundation
import Supabase

/// Felles Supabase-klient – samme prosjekt og regler (RLS) som webappen.
let supabase = SupabaseClient(
    supabaseURL: URL(string: Secrets.supabaseURL)!,
    supabaseKey: Secrets.supabaseKey,
    options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
)

/// Dekoder svar fra PostgREST med snake_case → camelCase.
let flokkDecoder: JSONDecoder = {
    let d = JSONDecoder()
    d.keyDecodingStrategy = .convertFromSnakeCase
    return d
}()

extension PostgrestBuilder {
    func decoded<T: Decodable>(as type: T.Type = T.self) async throws -> T {
        let response = try await execute()
        return try flokkDecoder.decode(T.self, from: response.data)
    }
}

/// Lenke til webversjonen (deling, registrering).
func siteURL(_ path: String) -> URL {
    URL(string: Secrets.siteURL.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path)!
}
