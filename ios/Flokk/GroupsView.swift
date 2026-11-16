import SwiftUI

struct GroupsView: View {
    @Environment(AuthModel.self) private var auth
    @State private var groups: [FlokkGroup] = []
    @State private var loaded = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    if loaded && groups.isEmpty {
                        ContentUnavailableView(
                            "Ingen flokker ennå",
                            systemImage: "person.3",
                            description: Text("Lag en flokk eller bli med via en invitasjonslenke.")
                        )
                    }
                    ForEach(groups) { g in
                        NavigationLink(value: g) { GroupTile(group: g) }
                            .buttonStyle(.plain)
                    }
                    if let error { Text(error).foregroundStyle(.red) }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Mine flokker")
            .navigationDestination(for: FlokkGroup.self) { GroupView(group: $0) }
            .navigationDestination(for: EventSummary.self) { EventView(eventId: $0.id) }
            .refreshable { await load() }
            .task { await load() }
            .overlay { if !loaded { ProgressView() } }
        }
    }

    private func load() async {
        guard let uid = auth.userId else { return }
        do {
            let rows: [Membership] = try await supabase
                .from("group_members")
                .select("role, groups(id, slug, name, description, visibility, tint, backdrop, emoji)")
                .eq("user_id", value: uid)
                .order("joined_at")
                .decoded()
            groups = rows.compactMap(\.groups)
            error = nil
        } catch {
            self.error = "Kunne ikke hente flokkene."
        }
        loaded = true
    }
}

struct GroupTile: View {
    let group: FlokkGroup

    var body: some View {
        HStack(spacing: 14) {
            Text(group.emoji ?? "🪺").font(.system(size: 40))
            VStack(alignment: .leading, spacing: 4) {
                Text(group.name).font(.title3.bold()).foregroundStyle(.primary)
                if let d = group.description, !d.isEmpty {
                    Text(d).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.secondary)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .leading)
        .background { Surface(backdrop: group.backdrop, tint: group.tint) }
        .clipShape(.rect(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
    }
}
