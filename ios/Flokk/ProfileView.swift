import SwiftUI

struct ProfileView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(PushManager.self) private var push
    @State private var name = ""
    @State private var saved = false
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        AvatarView(name: name.isEmpty ? "?" : name, size: 56)
                        VStack(alignment: .leading) {
                            Text(name.isEmpty ? "Uten navn" : name).font(.headline)
                            Text(auth.email ?? "").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
                Section {
                    TextField("Visningsnavn", text: $name)
                        .textContentType(.name)
                    Button(busy ? "Lagrer …" : "Lagre navn") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                } header: {
                    Text("Visningsnavn")
                } footer: {
                    if let error { Text(error).foregroundStyle(.red) }
                    else if saved { Label("Lagret", systemImage: "checkmark").foregroundStyle(.green) }
                    else { Text("Dette er navnet de andre i flokkene dine ser.") }
                }
                Section {
                    switch push.status {
                    case .authorized, .provisional, .ephemeral:
                        if push.registered {
                            Label("Varsler er på for denne telefonen", systemImage: "bell.badge.fill")
                        } else {
                            Label("Varsler er tillatt, men telefonen er ikke registrert ennå", systemImage: "bell.slash")
                        }
                    default:
                        PushPrompt()
                    }
                } header: {
                    Text("Varsler")
                } footer: {
                    if let e = push.lastError { Text(e) }
                }
                Section {
                    Button("Logg ut", role: .destructive) { Task { await auth.signOut() } }
                }
            }
            .navigationTitle("Min profil")
            .task { await load() }
        }
    }

    private func load() async {
        guard let uid = auth.userId else { return }
        struct Row: Decodable { let displayName: String }
        if let r: Row = try? await supabase.from("profiles").select("display_name").eq("id", value: uid).single().decoded() {
            name = r.displayName
        }
    }

    private func save() async {
        guard let uid = auth.userId else { return }
        let clean = name.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        guard !clean.isEmpty, clean.count <= 50 else {
            error = "Navnet må være 1–50 tegn."
            return
        }
        busy = true
        saved = false
        do {
            try await supabase.from("profiles").update(["display_name": clean]).eq("id", value: uid).execute()
            name = clean
            saved = true
            error = nil
        } catch {
            self.error = "Kunne ikke lagre navnet."
        }
        busy = false
    }
}
