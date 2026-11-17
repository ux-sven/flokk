import SwiftUI
import Supabase

/// Godta en invitasjon fra en lenke (flokk://invitasjon/<token> eller nettadressen).
struct InvitationView: View {
    let token: String
    @Environment(\.dismiss) private var dismiss
    @Environment(Router.self) private var router
    @State private var info: Info?
    @State private var loaded = false
    @State private var error: String?
    @State private var busy = false

    nonisolated struct Info: Decodable {
        let groupId: UUID
        let groupSlug: String
        let groupName: String
        let groupDescription: String?
        let valid: Bool
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                if let info {
                    Text("🪺").font(.system(size: 64))
                    Text("Du er invitert til").foregroundStyle(.secondary)
                    Text(info.groupName).font(.largeTitle.bold()).multilineTextAlignment(.center)
                    if let d = info.groupDescription, !d.isEmpty {
                        Text(d).multilineTextAlignment(.center).foregroundStyle(.secondary)
                    }
                    if info.valid {
                        Button { Task { await accept() } } label: {
                            Text(busy ? "Blir med …" : "Bli med i flokken").frame(maxWidth: .infinity).padding(.vertical, 6)
                        }
                        .prominentButton()
                        .buttonBorderShape(.capsule)
                        .disabled(busy)
                    } else {
                        Text("Invitasjonen er utløpt. Be om en ny lenke.").foregroundStyle(.red)
                    }
                } else if loaded {
                    ContentUnavailableView("Fant ikke invitasjonen", systemImage: "link.badge.plus", description: Text("Lenken kan være feil eller slettet."))
                } else {
                    ProgressView()
                }
                if let error { Text(error).foregroundStyle(.red).multilineTextAlignment(.center) }
            }
            .padding(28)
            .toolbar { Button("Lukk") { dismiss() } }
            .task { await load() }
        }
    }

    private func load() async {
        let rows: [Info]? = try? await supabase.rpc("get_invitation", params: ["invite_token": token]).decoded()
        info = rows?.first
        loaded = true
    }

    private func accept() async {
        busy = true
        do {
            _ = try await supabase.rpc("accept_invitation", params: ["invite_token": token]).execute()
            router.groupsVersion += 1
            dismiss()
            router.open(PushTarget(groupId: info!.groupId, eventId: nil, isMessage: false))
        } catch {
            self.error = planLimitMessage(error)
                ?? "Kunne ikke bli med. Invitasjonen kan være utløpt eller gjelde en annen e-postadresse."
        }
        busy = false
    }
}
