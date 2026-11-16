import Supabase
import SwiftUI

/// Innstillinger for en flokk: navn, ikon, beskrivelse og synlighet (admin),
/// roller, overføring av eierskap og sletting (eier).
struct GroupSettingsView: View {
    let group: FlokkGroup
    let members: [Member]
    let myUserId: UUID?
    let isOwner: Bool
    var onSaved: (FlokkGroup) -> Void
    var onMembersChanged: () async -> Void
    var onDeleted: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var emoji: String
    @State private var description: String
    @State private var visibility: String
    @State private var membersCanInvite: Bool
    @State private var newOwner: Member?
    @State private var confirmDelete = false
    @State private var deleteName = ""
    @State private var busy = false
    @State private var error: String?

    init(group: FlokkGroup, members: [Member], myUserId: UUID?, isOwner: Bool,
         onSaved: @escaping (FlokkGroup) -> Void, onMembersChanged: @escaping () async -> Void, onDeleted: @escaping () -> Void) {
        self.group = group
        self.members = members
        self.myUserId = myUserId
        self.isOwner = isOwner
        self.onSaved = onSaved
        self.onMembersChanged = onMembersChanged
        self.onDeleted = onDeleted
        _name = State(initialValue: group.name)
        _emoji = State(initialValue: group.emoji ?? "")
        _description = State(initialValue: group.description ?? "")
        _visibility = State(initialValue: group.visibility)
        _membersCanInvite = State(initialValue: group.membersCanInvite ?? true)
    }

    private var others: [Member] { members.filter { $0.userId != myUserId } }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("🪺", text: $emoji).frame(width: 44).multilineTextAlignment(.center).font(.title2)
                        TextField("Navn", text: $name).font(.title3.weight(.semibold))
                    }
                    TextField("Beskrivelse", text: $description, axis: .vertical).lineLimit(2...6)
                }
                Section {
                    Picker("Hvem kan bli med?", selection: $visibility) {
                        Text("Kun inviterte").tag("invite_only")
                        Text("Åpen for alle").tag("open")
                    }
                    Toggle("Alle medlemmer kan invitere", isOn: $membersCanInvite)
                } footer: {
                    Text("Slår du av invitasjon for medlemmer, er det bare admins som kan lage invitasjonslenker. Adressen (/\(group.slug)) endres ikke.")
                }

                if isOwner {
                    Section {
                        if others.isEmpty { Text("Ingen andre medlemmer ennå.").foregroundStyle(.secondary) }
                        ForEach(others) { m in
                            Toggle(m.name, isOn: Binding(
                                get: { m.role == "admin" },
                                set: { v in Task { await setRole(m, admin: v) } }
                            ))
                            .disabled(busy)
                        }
                    } header: { Text("Admins") } footer: {
                        Text("Admins kan invitere, endre flokken og arrangementene, og fjerne vanlige medlemmer.")
                    }

                    Section {
                        Menu {
                            ForEach(others) { m in Button(m.name) { newOwner = m } }
                        } label: {
                            Label("Overfør eierskap …", systemImage: "crown")
                        }
                        .disabled(others.isEmpty || busy)
                        Button(role: .destructive) { confirmDelete = true } label: {
                            Label("Slett flokken", systemImage: "trash")
                        }
                    } header: { Text("Eier") } footer: {
                        Text("Eieren kan ikke melde seg ut. Overfør eierskapet først – du blir da admin.")
                    }
                }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Innstillinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
            .confirmationDialog(
                "Gjøre \(newOwner?.name ?? "") til eier?",
                isPresented: Binding(get: { newOwner != nil }, set: { if !$0 { newOwner = nil } }),
                titleVisibility: .visible
            ) {
                Button("Overfør eierskap") { if let m = newOwner { Task { await transfer(to: m) } } }
            } message: {
                Text("Du blir admin, og bare den nye eieren kan gi eierskapet tilbake.")
            }
            .alert("Slette \(group.name)?", isPresented: $confirmDelete) {
                TextField(group.name, text: $deleteName)
                Button("Slett for godt", role: .destructive) { Task { await deleteGroup() } }
                Button("Avbryt", role: .cancel) { deleteName = "" }
            } message: {
                Text("Alle arrangementer, stemmer, oppgaver og chat slettes. Skriv navnet på flokken for å bekrefte.")
            }
        }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        let clean = name.trimmingCharacters(in: .whitespaces)
        let icon = String(emoji.trimmingCharacters(in: .whitespaces).prefix(8))
        do {
            let rows: [FlokkGroup] = try await supabase.from("groups")
                .update([
                    "name": AnyJSON.string(String(clean.prefix(80))),
                    "description": .string(String(description.trimmingCharacters(in: .whitespacesAndNewlines).prefix(500))),
                    "visibility": .string(visibility),
                    "members_can_invite": .bool(membersCanInvite),
                    "emoji": icon.isEmpty ? .null : .string(icon),
                ])
                .eq("id", value: group.id)
                .select("*")
                .decoded()
            guard let g = rows.first else { error = "Bare admins kan endre flokken."; return }
            onSaved(g)
            dismiss()
        } catch {
            self.error = "Kunne ikke lagre endringene."
        }
    }

    private func setRole(_ m: Member, admin: Bool) async {
        busy = true
        defer { busy = false }
        struct Row: Decodable { let userId: UUID }
        let rows: [Row]? = try? await supabase.from("group_members")
            .update(["role": admin ? "admin" : "member"])
            .eq("group_id", value: group.id).eq("user_id", value: m.userId)
            .select("user_id").decoded()
        if rows?.isEmpty ?? true { error = "Kunne ikke endre rollen." }
        await onMembersChanged()
    }

    private func transfer(to m: Member) async {
        busy = true
        defer { busy = false }
        do {
            try await supabase.rpc("transfer_group_ownership", params: [
                "gid": group.id.uuidString.lowercased(), "new_owner": m.userId.uuidString.lowercased(),
            ]).execute()
            await onMembersChanged()
            dismiss()
        } catch {
            self.error = "Kunne ikke overføre eierskapet."
        }
    }

    private func deleteGroup() async {
        guard deleteName.trimmingCharacters(in: .whitespaces) == group.name else {
            error = "Navnet stemmer ikke, så flokken ble ikke slettet."
            deleteName = ""
            return
        }
        busy = true
        defer { busy = false }
        struct Row: Decodable { let id: UUID }
        let rows: [Row]? = try? await supabase.from("groups").delete().eq("id", value: group.id).select("id").decoded()
        if rows?.isEmpty ?? true { error = "Bare eieren kan slette flokken."; return }
        dismiss()
        onDeleted()
    }
}
