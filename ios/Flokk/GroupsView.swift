import SwiftUI

struct GroupsView: View {
    @Environment(AuthModel.self) private var auth
    @Environment(Router.self) private var router
    @Environment(PushManager.self) private var push
    @State private var groups: [FlokkGroup] = []
    @State private var loaded = false
    @State private var error: String?
    @State private var creating = false
    @State private var groupLimit: LimitReason?

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            ScrollView {
                LazyVStack(spacing: 16) {
                    if push.status == .notDetermined && loaded && !groups.isEmpty {
                        PushPrompt()
                            .padding(18)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card()
                    }
                    if loaded && groups.isEmpty {
                        ContentUnavailableView(
                            "Ingen flokker ennå",
                            systemImage: "person.3",
                            description: Text("Lag en flokk eller bli med via en invitasjonslenke.")
                        )
                    }
                    ForEach(groups) { g in
                        NavigationLink(value: Route.group(g)) { GroupTile(group: g) }
                            .buttonStyle(.plain)
                    }
                    if let error { Text(error).foregroundStyle(.red) }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Mine flokker")
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .group(let g): GroupView(group: g)
                case .event(let id): EventView(eventId: id)
                case .chat(let groupId, let eventId): ChatView(groupId: groupId, eventId: eventId)
                }
            }
            .toolbar {
                Button { Task { await startNewGroup() } } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Ny flokk")
            }
            .sheet(item: $groupLimit) { limit in PlusView(reason: limit.text) }
            .sheet(isPresented: $creating) {
                CreateGroupView { g in
                    groups.append(g)
                    router.path = [.group(g)]
                }
            }
            .refreshable { await load() }
            .task(id: router.groupsVersion) { await load() }
            .overlay { if !loaded { ProgressView() } }
        }
    }

    /// Gratisgrensen sjekkes før skjemaet, så ingen fyller ut en flokk som ikke kan lagres.
    private func startNewGroup() async {
        if let plan: MyPlan = try? await supabase.rpc("my_plan").decoded(),
           !plan.plus, plan.ownedGroups >= plan.maxGroups {
            groupLimit = LimitReason(text: "Du eier allerede \(plan.ownedGroups) flokker, som er grensen i gratisversjonen. Med Flokk Pluss kan du lage så mange du vil.")
        } else {
            creating = true
        }
    }

    private func load() async {
        guard let uid = auth.userId else { return }
        do {
            let rows: [Membership] = try await supabase
                .from("group_members")
                .select("role, groups(*)")
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
