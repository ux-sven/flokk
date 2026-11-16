import SwiftUI
import Supabase

/// Oppgaver for et arrangement: hvem tar med hva.
struct TaskListView: View {
    let eventId: UUID
    let tasks: [EventTask]
    let members: [Member]
    let onChange: () async -> Void
    @Environment(AuthModel.self) private var auth
    @State private var newTitle = ""
    @State private var newAssignee: UUID?
    @State private var error: String?
    @FocusState private var focused: Bool

    private func name(_ id: UUID?) -> String? {
        guard let id else { return nil }
        if id == auth.userId { return "Deg" }
        return members.first { $0.userId == id }?.name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Oppgaver").font(.title2.bold())
                Spacer()
                if !tasks.isEmpty {
                    Text("\(tasks.filter(\.isDone).count) av \(tasks.count) ferdig").font(.subheadline).foregroundStyle(.secondary)
                }
            }
            VStack(spacing: 0) {
                ForEach(tasks) { t in
                    row(t)
                    Divider().padding(.leading, 44)
                }
                HStack(spacing: 10) {
                    Image(systemName: "plus.circle.fill").foregroundStyle(.secondary).font(.title3)
                    TextField("Ny oppgave, f.eks. «Ta med kake»", text: $newTitle)
                        .focused($focused)
                        .submitLabel(.done)
                        .onSubmit { Task { await add() } }
                    assigneeMenu(selection: newAssignee) { newAssignee = $0 }
                }
                .padding(14)
            }
            .card()
            if let error { Text(error).font(.callout).foregroundStyle(.red) }
        }
    }

    private func row(_ t: EventTask) -> some View {
        HStack(spacing: 10) {
            Button { Task { await update(t, ["status": .string(t.isDone ? "todo" : "done")]) } } label: {
                Image(systemName: t.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(t.isDone ? Color.green : .secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(t.isDone ? "Merk som ikke ferdig" : "Merk som ferdig")
            Text(t.title)
                .strikethrough(t.isDone)
                .foregroundStyle(t.isDone ? .secondary : .primary)
            Spacer()
            assigneeMenu(selection: t.assigneeId) { id in
                Task { await update(t, ["assignee_id": id.map { .string($0.uuidString.lowercased()) } ?? .null]) }
            }
        }
        .padding(14)
        .contextMenu {
            Button(role: .destructive) { Task { await delete(t) } } label: { Label("Slett oppgaven", systemImage: "trash") }
        }
    }

    private func assigneeMenu(selection: UUID?, onPick: @escaping (UUID?) -> Void) -> some View {
        Menu {
            Button("Ingen") { onPick(nil) }
            if let me = auth.userId { Button("Meg") { onPick(me) } }
            Divider()
            ForEach(members.filter { $0.userId != auth.userId }) { m in Button(m.name) { onPick(m.userId) } }
        } label: {
            Text(name(selection) ?? "Ledig")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(selection == nil ? Color(.tertiarySystemFill) : Tint.color("mint"), in: .capsule)
                .foregroundStyle(.primary)
        }
        .accessibilityLabel("Ansvarlig: \(name(selection) ?? "ingen")")
    }

    private func add() async {
        let title = newTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        var row: [String: String?] = ["event_id": eventId.uuidString.lowercased(), "title": String(title.prefix(200))]
        row["assignee_id"] = .some(newAssignee?.uuidString.lowercased())
        do {
            try await supabase.from("event_tasks").insert(row).execute()
            newTitle = ""
            newAssignee = nil
            error = nil
            await onChange()
        } catch {
            self.error = "Kunne ikke legge til oppgaven."
        }
    }

    private func update(_ t: EventTask, _ patch: [String: AnyJSON]) async {
        _ = try? await supabase.from("event_tasks").update(patch).eq("id", value: t.id).execute()
        await onChange()
    }

    private func delete(_ t: EventTask) async {
        _ = try? await supabase.from("event_tasks").delete().eq("id", value: t.id).execute()
        await onChange()
    }
}
