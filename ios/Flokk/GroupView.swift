import Supabase
import SwiftUI

struct GroupView: View {
    @State private var group: FlokkGroup
    @State private var editingSettings = false
    @Environment(AuthModel.self) private var auth
    @Environment(\.scenePhase) private var scenePhase
    @State private var events: [EventSummary] = []
    @State private var members: [Member] = []
    @State private var presence = PresenceModel()
    @State private var creatingEvent = false
    @State private var inviting = false
    @State private var editingLook = false
    @State private var confirmLeave = false
    @State private var memberToRemove: Member?
    @State private var notifyLevel = "all"
    @State private var look: (tint: String?, backdrop: String?)?
    @State private var error: String?
    @Environment(Router.self) private var router

    init(group: FlokkGroup) { _group = State(initialValue: group) }

    private var myRole: String? { members.first { $0.userId == auth.userId }?.role }
    private var isAdmin: Bool { myRole == "owner" || myRole == "admin" }
    private var canInvite: Bool { isAdmin || (myRole != nil && group.membersCanInvite == true) }
    private var tint: String? { look?.tint ?? group.tint }
    private var backdrop: String? { look.map { $0.backdrop } ?? group.backdrop }

    private var othersOnline: [Member] {
        members.filter { $0.userId != auth.userId && presence.online.contains($0.userId) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header
                if !othersOnline.isEmpty { OnlineNowRow(people: othersOnline) }

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Arrangementer").font(.title2.bold())
                        Spacer()
                        Button { creatingEvent = true } label: { Label("Nytt", systemImage: "calendar.badge.plus") }
                            .buttonStyle(.borderedProminent)
                            .buttonBorderShape(.capsule)
                    }
                    let sections = EventSections(events)
                    if sections.upcoming.isEmpty && sections.voting.isEmpty {
                        Text(sections.past.isEmpty ? "Ingen arrangementer ennå." : "Ingen kommende arrangementer.")
                            .foregroundStyle(.secondary)
                            .padding(20)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .card()
                    }
                    EventSectionList(title: "Kommende", events: sections.upcoming, groupTint: tint, groupBackdrop: backdrop)
                    EventSectionList(title: "Stemming pågår", events: sections.voting, groupTint: tint, groupBackdrop: backdrop)
                    if !sections.past.isEmpty {
                        DisclosureGroup {
                            VStack(spacing: 0) {
                                ForEach(sections.past) { e in
                                    NavigationLink(value: Route.event(e.id)) {
                                        HStack {
                                            Text(e.title).lineLimit(1)
                                            Spacer()
                                            Text(e.chosen.map { Fmt.dateTime($0.startsAt) } ?? "")
                                                .font(.caption).foregroundStyle(.secondary)
                                        }
                                        .padding(.vertical, 8)
                                        .contentShape(.rect)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.top, 8)
                        } label: {
                            Label("Tidligere arrangementer · \(sections.past.count)", systemImage: "clock.arrow.circlepath")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .card()
                    }
                }

                NavigationLink(value: Route.chat(groupId: group.id, eventId: nil)) {
                    Label("Gruppechat", systemImage: "bubble.left.and.bubble.right")
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                        .card()
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Medlemmer · \(members.count)").font(.title3.bold())
                    ForEach(members) { m in
                        HStack(spacing: 12) {
                            AvatarView(name: m.name, url: m.profiles?.avatarUrl, online: presence.online.contains(m.userId))
                            Text(m.name + (m.userId == auth.userId ? " (deg)" : "")).font(.subheadline.weight(.medium))
                            Spacer()
                            if let role = roleLabel(m.role) {
                                Text(role).font(.caption.weight(.medium))
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(.quaternary, in: .capsule)
                            }
                        }
                        .contextMenu {
                            if canRemove(m) {
                                Button(role: .destructive) { memberToRemove = m } label: {
                                    Label("Fjern fra flokken", systemImage: "person.badge.minus")
                                }
                            }
                        }
                    }
                    if canInvite {
                        Button { inviting = true } label: {
                            Label("Inviter folk", systemImage: "person.badge.plus").frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .padding(.top, 4)
                    }
                    if let error { Text(error).font(.callout).foregroundStyle(.red) }
                }
                .padding(20)
                .card()
            }
            .padding()
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(group.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { groupMenu }
        .sheet(isPresented: $inviting) { InviteSheet(group: group).presentationDetents([.medium]) }
        .sheet(isPresented: $editingLook) { lookSheet }
        .sheet(isPresented: $editingSettings) {
            GroupSettingsView(
                group: group, members: members, myUserId: auth.userId, isOwner: myRole == "owner",
                onSaved: { g in
                    group = g
                    router.groupsVersion += 1
                },
                onMembersChanged: { await load() },
                onDeleted: {
                    router.groupsVersion += 1
                    router.path = []
                }
            )
        }
        .confirmationDialog("Melde deg ut av \(group.name)?", isPresented: $confirmLeave, titleVisibility: .visible) {
            Button("Meld meg ut", role: .destructive) { Task { await leave() } }
        } message: {
            Text("Du mister tilgang til arrangementer og chat, og oppgavene dine blir ledige igjen.")
        }
        .confirmationDialog(
            "Fjerne \(memberToRemove?.name ?? "")?",
            isPresented: Binding(get: { memberToRemove != nil }, set: { if !$0 { memberToRemove = nil } }),
            titleVisibility: .visible
        ) {
            Button("Fjern fra flokken", role: .destructive) { if let m = memberToRemove { Task { await remove(m) } } }
        } message: {
            Text("Personen mister tilgang til arrangementer og chat, og oppgavene blir ledige igjen.")
        }
        .sheet(isPresented: $creatingEvent) {
            CreateEventView(group: group) { id in
                Task { await load() }
                router.path.append(.event(id))
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .task(id: scenePhase) {
            guard let uid = auth.userId else { return }
            if scenePhase == .active { await presence.start(groupId: group.id, userId: uid) } else { await presence.stop() }
        }
        .onDisappear { Task { await presence.stop() } }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(group.emoji ?? "🪺").font(.system(size: 48))
            Text(group.name).font(.largeTitle.bold())
            HStack(spacing: 4) {
                Image(systemName: group.visibility == "open" ? "globe" : "lock")
                Text(group.visibility == "open" ? "Åpen" : "Kun inviterte")
            }
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(.thinMaterial, in: .capsule)
            if let d = group.description, !d.isEmpty { Text(d).opacity(0.8) }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { Surface(backdrop: backdrop, tint: tint) }
        .clipShape(.rect(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
    }

    private var groupMenu: some View {
        Menu {
            ShareLink(item: siteURL("/\(group.slug)")) { Label("Del lenke til flokken", systemImage: "link") }
            if canInvite {
                Button { inviting = true } label: { Label("Inviter folk", systemImage: "person.badge.plus") }
            }
            if isAdmin {
                Button { editingLook = true } label: { Label("Utseende", systemImage: "paintpalette") }
                Button { editingSettings = true } label: { Label("Innstillinger", systemImage: "gearshape") }
            }
            Picker(selection: Binding(get: { notifyLevel }, set: { v in Task { await setNotify(v) } })) {
                Text("Alt").tag("all")
                Text("Det viktigste").tag("important")
                Text("Ingenting").tag("none")
            } label: {
                Label("Varsler fra flokken", systemImage: "bell")
            }
            .pickerStyle(.menu)
            if myRole != "owner" && myRole != nil {
                Divider()
                Button(role: .destructive) { confirmLeave = true } label: {
                    Label("Meld meg ut av flokken", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("Valg for flokken")
    }

    private var lookSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TintPicker(selection: Binding(get: { tint ?? "mint" }, set: { v in Task { await setLook(tint: v, backdrop: backdrop) } }))
                    BackdropPicker(
                        selection: Binding(get: { backdrop.flatMap { knownBackdrops.contains($0) ? $0 : nil } },
                                           set: { v in Task { await setLook(tint: tint ?? "mint", backdrop: v) } }),
                        tint: tint
                    )
                }
                .padding()
            }
            .navigationTitle("Utseende")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Ferdig") { editingLook = false } }
        }
        .presentationDetents([.medium, .large])
    }

    private func canRemove(_ m: Member) -> Bool {
        guard m.userId != auth.userId else { return false }
        return myRole == "owner" || (myRole == "admin" && m.role == "member")
    }

    private func setNotify(_ level: String) async {
        let before = notifyLevel
        notifyLevel = level
        do {
            try await supabase.rpc("set_notify_level", params: ["gid": group.id.uuidString.lowercased(), "level": level]).execute()
        } catch {
            notifyLevel = before
            self.error = "Kunne ikke endre varslingsnivået."
        }
    }

    private func setLook(tint: String, backdrop: String?) async {
        let before = look
        look = (tint, backdrop)
        do {
            let rows: [FlokkGroup] = try await supabase.from("groups")
                .update(["tint": AnyJSON.string(tint), "backdrop": backdrop.map(AnyJSON.string) ?? .null])
                .eq("id", value: group.id)
                .select("*").decoded()
            if rows.isEmpty { look = before; error = "Bare admins kan endre utseendet." }
            router.groupsVersion += 1
        } catch {
            look = before
            self.error = "Kunne ikke lagre utseendet."
        }
    }

    private func leave() async {
        guard let uid = auth.userId else { return }
        do {
            try await supabase.from("group_members").delete().eq("group_id", value: group.id).eq("user_id", value: uid).execute()
            router.groupsVersion += 1
            router.path = []
        } catch {
            self.error = "Kunne ikke melde deg ut."
        }
    }

    private func remove(_ m: Member) async {
        struct Row: Decodable { let userId: UUID }
        let rows: [Row]? = try? await supabase.from("group_members").delete()
            .eq("group_id", value: group.id).eq("user_id", value: m.userId).select("user_id").decoded()
        if rows?.isEmpty ?? true { error = "Du har ikke lov til å fjerne dette medlemmet." }
        await load()
    }

    private func roleLabel(_ r: String) -> String? {
        switch r { case "owner": "Eier"; case "admin": "Admin"; default: nil }
    }

    private func load() async {
        async let ev: [EventSummary] = supabase
            .from("events")
            .select("id, title, status, location, backdrop, created_at, chosen:event_time_options!events_chosen_option_fk(starts_at)")
            .eq("group_id", value: group.id)
            .neq("status", value: "cancelled")
            .is("archived_at", value: nil)
            .order("created_at", ascending: false)
            .decoded()
        async let mem: [Member] = supabase
            .from("group_members")
            .select("user_id, role, profiles(id, display_name, avatar_url)")
            .eq("group_id", value: group.id)
            .order("joined_at")
            .decoded()
        if let e = try? await ev { events = e }
        if let m = try? await mem { members = m }
        struct Level: Decodable { let notifyLevel: String }
        if let uid = auth.userId, let l: Level = try? await supabase.from("group_members").select("notify_level")
            .eq("group_id", value: group.id).eq("user_id", value: uid).single().decoded() {
            notifyLevel = l.notifyLevel
        }
    }
}

struct EventSectionList: View {
    let title: String
    let events: [EventSummary]
    var groupTint: String?
    var groupBackdrop: String?

    var body: some View {
        if !events.isEmpty {
            Text("\(title) · \(events.count)".uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.top, 4)
            ForEach(events) { e in
                NavigationLink(value: Route.event(e.id)) {
                    EventCard(event: e, groupTint: groupTint, groupBackdrop: groupBackdrop)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct EventCard: View {
    let event: EventSummary
    var groupTint: String?
    var groupBackdrop: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Samme stripe på alle kort: arrangementets bakgrunn, ellers flokkens
            let own = event.backdrop.flatMap { knownBackdrops.contains($0) ? $0 : nil }
            Color.clear.frame(height: 64)
                .overlay { Surface(backdrop: own ?? groupBackdrop, tint: own == nil ? groupTint : nil) }
                .clipped()
            VStack(alignment: .leading, spacing: 4) {
                Group {
                    if let c = event.chosen {
                        Label(Fmt.dateTime(c.startsAt), systemImage: "calendar")
                            .foregroundStyle(.primary)
                    } else {
                        Label("Stemming pågår", systemImage: "hand.raised")
                            .foregroundStyle(.orange)
                    }
                }
                .font(.caption.weight(.semibold))
                .labelStyle(.titleAndIcon)
                Text(event.title).font(.headline)
                if let l = event.location { Text(l).font(.caption).foregroundStyle(.secondary) }
            }
            .padding(18)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
        .clipShape(.rect(cornerRadius: 24))
    }
}

struct OnlineNowRow: View {
    let people: [Member]

    var body: some View {
        HStack(spacing: 10) {
            Circle().fill(.green).frame(width: 9, height: 9)
            HStack(spacing: -8) {
                ForEach(people.prefix(5)) { AvatarView(name: $0.name, url: $0.profiles?.avatarUrl, size: 26) }
            }
            Text(label).font(.subheadline.weight(.medium)).lineLimit(1)
        }
        .padding(.horizontal, 14).padding(.vertical, 10)
        .background(Color.green.opacity(0.12), in: .capsule)
        .accessibilityElement(children: .combine)
    }

    private var label: String {
        switch people.count {
        case 1: "\(people[0].name) er også inne nå"
        case 2: "\(people[0].name) og \(people[1].name) er også inne nå"
        default: "\(people[0].name) og \(people.count - 1) andre er også inne nå"
        }
    }
}
