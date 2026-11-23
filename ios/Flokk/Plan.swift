import Foundation
import Supabase
import StoreKit
import SwiftUI

// Flokk Pluss: gratisgrenser og status. Grensene håndheves i databasen
// (supabase/migrations/20261117120000_plans.sql); her brukes de bare til visning.

/// Din plan, fra rpc("my_plan").
nonisolated struct MyPlan: Decodable, Sendable {
    let plus: Bool
    let source: String?
    let expiresAt: String?
    let ownedGroups: Int
    let maxGroups: Int
}

/// En flokks grenser, fra rpc("group_plan"). max* er nil når eieren har Pluss.
nonisolated struct GroupPlan: Decodable, Sendable {
    let plus: Bool
    let members: Int
    let maxMembers: Int?
    let upcomingEvents: Int
    let maxUpcomingEvents: Int?

    var eventsFull: Bool { maxUpcomingEvents.map { upcomingEvents >= $0 } ?? false }
    var membersFull: Bool { maxMembers.map { members >= $0 } ?? false }
}

/// En gratisgrense som er nådd, vist øverst på kjøpsskjermen.
struct LimitReason: Identifiable {
    let id = UUID()
    let text: String
}

/// Meldingen fra databasen når en gratisgrense er nådd (hint «plan_limit:…»), ellers nil.
func planLimitMessage(_ error: Error) -> String? {
    guard let e = error as? PostgrestError, e.hint?.hasPrefix("plan_limit:") == true else { return nil }
    return e.message
}

/// Planen din på profilsiden.
struct PlanSection: View {
    let plan: MyPlan
    @State private var upgrading = false
    @State private var managing = false

    var body: some View {
        Section {
            if plan.plus {
                Label("Flokk Pluss", systemImage: "sparkles").foregroundStyle(.tint)
                if plan.source == "app_store" {
                    Button("Administrer abonnement") { managing = true }
                }
            } else {
                LabeledContent("Gratisversjonen", value: "\(plan.ownedGroups) av \(plan.maxGroups) flokker")
                VStack(alignment: .leading, spacing: 4) {
                    Text("Eie inntil \(plan.maxGroups) flokker")
                    Text("Inntil 8 medlemmer i hver flokk")
                    Text("Ett kommende arrangement om gangen i hver flokk")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                Button { upgrading = true } label: {
                    Label("Oppgrader til Flokk Pluss", systemImage: "sparkles")
                }
            }
        } header: {
            Text("Abonnement")
        } footer: {
            Text(plan.plus
                ? "Ingen grenser på flokker, medlemmer eller arrangementer i flokkene du eier."
                : "Med Flokk Pluss forsvinner grensene for alle flokkene du eier.")
        }
        .sheet(isPresented: $upgrading) { PlusView() }
        .manageSubscriptionsSheet(isPresented: $managing)
    }
}
