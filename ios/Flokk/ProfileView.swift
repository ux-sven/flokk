import Supabase
import StoreKit
import SwiftUI

struct ProfileView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(PushManager.self) private var push
    @State private var name = ""
    @State private var saved = false
    @State private var error: String?
    @State private var busy = false
    @State private var testResult: String?
    @State private var testing = false
    @State private var confirmDelete = false
    @State private var deleteText = ""
    @State private var deleteError: String?
    @State private var plan: MyPlan?
    @State private var upgrading = false
    @State private var managing = false

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
                if let plan { PlanSection(plan: plan, upgrading: $upgrading, managing: $managing) }
                Section {
                    switch push.status {
                    case .authorized, .provisional, .ephemeral:
                        if push.registered {
                            Label("Varsler er på for denne telefonen", systemImage: "bell.badge.fill")
                            Button(testing ? "Sender …" : "Send testvarsel") {
                                Task {
                                    testing = true
                                    testResult = await push.sendTest()
                                    testing = false
                                }
                            }
                            .disabled(testing)
                        } else {
                            Label("Varsler er tillatt, men telefonen er ikke registrert ennå", systemImage: "bell.slash")
                        }
                    default:
                        PushPrompt()
                    }
                } header: {
                    Text("Varsler")
                } footer: {
                    if let testResult { Text(testResult) }
                    else if let e = push.lastError { Text(e) }
                }
                BlockedUsersSection()
                Section {
                    Button("Logg ut", role: .destructive) { Task { await auth.signOut() } }
                }
                Section {
                    Link(destination: siteURL("/personvern")) {
                        Label("Personvernerklæring", systemImage: "hand.raised")
                    }
                    Button(role: .destructive) { confirmDelete = true } label: {
                        Label("Slett kontoen", systemImage: "trash")
                    }
                } footer: {
                    if let deleteError { Text(deleteError).foregroundStyle(.red) }
                    else { Text("Profilen, medlemskapene, stemmene og meldingene dine slettes for godt. Er du eier av en flokk med andre medlemmer, må du overføre eierskapet først.") }
                }
            }
            .alert("Slette kontoen?", isPresented: $confirmDelete) {
                TextField("SLETT", text: $deleteText).textInputAutocapitalization(.characters)
                Button("Slett for godt", role: .destructive) { Task { await deleteAccount() } }
                Button("Avbryt", role: .cancel) { deleteText = "" }
            } message: {
                Text("Dette kan ikke angres. Skriv SLETT for å bekrefte.")
            }
            .navigationTitle("Min profil")
            .task(id: PlusStore.shared.version) { await load() }
            .sheet(isPresented: $upgrading) { PlusView() }
            .manageSubscriptionsSheet(isPresented: $managing)
        }
    }

    private func deleteAccount() async {
        defer { deleteText = "" }
        guard deleteText.trimmingCharacters(in: .whitespaces).uppercased() == "SLETT" else {
            deleteError = "Du må skrive SLETT for å slette kontoen."
            return
        }
        do {
            try await supabase.rpc("delete_account").execute()
            await auth.signOutAfterDeletion()
        } catch let e as PostgrestError where e.message.hasPrefix("Overfør eierskapet") {
            deleteError = e.message + "."
        } catch {
            deleteError = "Kunne ikke slette kontoen. Prøv igjen."
        }
    }

    private func load() async {
        guard let uid = auth.userId else { return }
        struct Row: Decodable { let displayName: String }
        if let r: Row = try? await supabase.from("profiles").select("display_name").eq("id", value: uid).single().decoded() {
            name = r.displayName
        }
        // nil hvis migrasjon 15 ikke er kjørt
        plan = try? await supabase.rpc("my_plan").decoded()
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
