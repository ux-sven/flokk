import SwiftUI
import Supabase

/// Lager en invitasjonslenke (gyldig i 14 dager) og deler den.
struct InviteSheet: View {
    let group: FlokkGroup
    @Environment(\.dismiss) private var dismiss
    @State private var url: URL?
    @State private var error: String?
    @State private var copied = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Image(systemName: "person.2.badge.plus.fill").font(.system(size: 44)).foregroundStyle(.tint)
                Text("Inviter til \(group.name)").font(.title2.bold()).multilineTextAlignment(.center)
                if let url {
                    Text(url.absoluteString)
                        .font(.footnote.monospaced())
                        .padding(12)
                        .frame(maxWidth: .infinity)
                        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
                        .textSelection(.enabled)
                    HStack {
                        ShareLink(item: url, message: Text("Bli med i \(group.name) på Flokk")) {
                            Label("Del", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                        }
                        .prominentButton()
                        Button {
                            UIPasteboard.general.url = url
                            copied = true
                        } label: {
                            Label(copied ? "Kopiert" : "Kopier", systemImage: copied ? "checkmark" : "doc.on.doc").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .sensoryFeedback(.success, trigger: copied)
                    }
                    .buttonBorderShape(.capsule)
                    Text("Lenken er gyldig i 14 dager.").font(.caption).foregroundStyle(.secondary)
                } else if let error {
                    Text(error).foregroundStyle(.red)
                } else {
                    ProgressView("Lager lenke …")
                }
            }
            .padding(24)
            .toolbar { Button("Ferdig") { dismiss() } }
            .task { await create() }
        }
    }

    private func create() async {
        struct Row: Decodable { let token: String }
        do {
            let row: Row = try await supabase.from("group_invitations")
                .insert(["group_id": group.id.uuidString.lowercased()])
                .select("token").single().decoded()
            url = siteURL("/invitasjon/\(row.token)")
        } catch {
            self.error = "Kunne ikke lage invitasjon."
        }
    }
}
