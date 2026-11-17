import Foundation
import Observation
import RevenueCat
import Supabase

/// Kjøp av Flokk Pluss via RevenueCat (App Store).
///
/// RevenueCat-brukeren er den samme som Supabase-brukeren (app user id = Supabase-id), så
/// Edge Function «revenuecat-webhook» kan skrive kjøpet til public.user_plans. Grensene
/// håndheves i databasen; her kjøper og gjenoppretter vi bare.
///
/// Uten Secrets.revenueCatKey (appl_…) er kjøp slått av, og kjøpsskjermen sier «kommer snart».
@Observable
final class PlusStore {
    static let shared = PlusStore()

    /// Øker når planen kan ha endret seg (kjøp, gjenoppretting), så visningene laster på nytt.
    private(set) var version = 0

    var isEnabled: Bool { !Secrets.revenueCatKey.isEmpty }
    private var configured = false

    func configure() {
        guard isEnabled, !configured else { return }
        Purchases.logLevel = .warn
        Purchases.configure(withAPIKey: Secrets.revenueCatKey)
        configured = true
    }

    /// Kalles når noen logger inn, så kjøpene knyttes til riktig Flokk-bruker.
    func logIn(_ userId: UUID) async {
        guard configured else { return }
        _ = try? await Purchases.shared.logIn(userId.uuidString.lowercased())
    }

    func logOut() async {
        guard configured, !Purchases.shared.isAnonymous else { return }
        _ = try? await Purchases.shared.logOut()
    }

    /// Pakkene i RevenueCat-tilbudet «default», sortert årlig, månedlig, livstid.
    func packages() async throws -> [Package] {
        guard configured else { return [] }
        let offerings = try await Purchases.shared.offerings()
        let order: [PackageType] = [.annual, .monthly, .lifetime]
        return (offerings.current?.availablePackages ?? []).sorted {
            (order.firstIndex(of: $0.packageType) ?? 99) < (order.firstIndex(of: $1.packageType) ?? 99)
        }
    }

    /// Kjøper pakken. false hvis brukeren avbrøt.
    func purchase(_ package: Package) async throws -> Bool {
        let result = try await Purchases.shared.purchase(package: package)
        if result.userCancelled { return false }
        await sync()
        return true
    }

    /// «Gjenopprett kjøp». Returnerer om brukeren har Pluss etterpå.
    func restore() async throws -> Bool {
        _ = try await Purchases.shared.restorePurchases()
        return await sync()
    }

    /// Ber serveren hente status fra RevenueCat med en gang, i stedet for å vente på webhooken.
    @discardableResult
    func sync() async -> Bool {
        defer { version += 1 }
        do {
            let r: SyncResult = try await supabase.functions.invoke(
                "revenuecat-webhook",
                options: FunctionInvokeOptions(body: ["sync": true])
            )
            return r.plus
        } catch {
            return false
        }
    }
}

nonisolated struct SyncResult: Decodable, Sendable {
    let plus: Bool
}
