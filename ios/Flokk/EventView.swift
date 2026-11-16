import SwiftUI
import Supabase

struct EventView: View {
    let eventId: UUID
    @Environment(AuthModel.self) private var auth
    @Environment(Router.self) private var router
    @State private var event: EventDetail?
    @State private var groupId: UUID?
    @State private var groupLook: (tint: String?, backdrop: String?) = (nil, nil)
    @State private var options: [TimeOption] = []
    @State private var members: [Member] = []
    @State private var tasks: [EventTask] = []
    @State private var error: String?
    @State private var channel: RealtimeChannelV2?
    @State private var suggesting = false
    @State private var editingBackdrop = false
    @State private var editingDetails = false
    @State private var confirmChoose: TimeOption?
    @State private var confirmDelete = false

    private var names: [UUID: String] { Dictionary(uniqueKeysWithValues: members.map { ($0.userId, $0.name) }) }
    private var chosen: TimeOption? { options.first { $0.id == event?.chosenOptionId } }
    private var myRole: String? { members.first { $0.userId == auth.userId }?.role }
    private var canManage: Bool { myRole == "owner" || myRole == "admin" || event?.createdBy == auth.userId }
    private var isArchived: Bool { event?.archivedAt != nil }
    private var canSuggest: Bool {
        guard let e = event, !isArchived else { return false }
        return canManage || ((e.allowTimeSuggestions ?? false) && e.status == "planning")
    }

    var body: some View {
        ScrollView {
            if let event {
                VStack(alignment: .leading, spacing: 24) {
                    if isArchived {
                        Label("Arrangementet er arkivert og vises ikke i flokkens liste.", systemImage: "archivebox")
                            .font(.subheadline).foregroundStyle(.secondary)
                            .padding(14).frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 16))
                    }
                    header(event)
                    voting
                    TaskListView(eventId: event.id, tasks: tasks, members: members, onChange: { await loadTasks() })
                    if let groupId {
                        NavigationLink(value: Route.chat(groupId: groupId, eventId: event.id)) {
                            Label("Chat for arrangementet", systemImage: "bubble.left.and.bubble.right")
                                .font(.headline)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(20)
                                .card()
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(event?.title ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if canManage, event != nil { manageMenu } }
        .overlay { if event == nil && error == nil { ProgressView() } }
        .refreshable { await load() }
        .task { await load(); await listen() }
        .onDisappear { if let channel { Task { await supabase.removeChannel(channel) } } }
        .sheet(isPresented: $suggesting) {
            SuggestTimeSheet(existing: options.compactMap { Fmt.date($0.startsAt) }) { date in await suggest(date) }
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $editingBackdrop) { backdropSheet }
        .sheet(isPresented: $editingDetails) {
            if let event {
                EditEventView(event: event) { patch in await update(patch) }
            }
        }
        .confirmationDialog(
            "Velge \(confirmChoose.map { Fmt.dateTime($0.startsAt) } ?? "")?",
            isPresented: Binding(get: { confirmChoose != nil }, set: { if !$0 { confirmChoose = nil } }),
            titleVisibility: .visible
        ) {
            Button("Velg tidspunktet") { if let o = confirmChoose { Task { await choose(o.id) } } }
        } message: {
            Text("Alle i flokken får beskjed, og stemmingen stenges.")
        }
        .confirmationDialog("Slette arrangementet?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Slett for alle", role: .destructive) { Task { await deleteEvent() } }
        } message: {
            Text("Tidspunkter, stemmer, oppgaver og chat slettes for godt. Vil du bare skjule det, kan du arkivere i stedet.")
        }
    }

    // MARK: Header

    private func header(_ e: EventDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(e.title).font(.largeTitle.bold())
            if let chosen {
                Label(Fmt.dateTime(chosen.startsAt), systemImage: "calendar.badge.checkmark")
                    .font(.subheadline.weight(.semibold))
            } else {
                Text("Stemming pågår").font(.caption.weight(.medium))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(.thinMaterial, in: .capsule)
            }
            if let loc = e.location {
                if let lat = e.locationLat, let lng = e.locationLng,
                   let url = URL(string: "https://www.google.com/maps/search/?api=1&query=\(lat),\(lng)") {
                    Link(destination: url) {
                        Label(loc, systemImage: "mappin.and.ellipse").underline()
                    }
                    .foregroundStyle(.primary)
                    .accessibilityHint("Åpner kart")
                } else {
                    Label(loc, systemImage: "mappin.and.ellipse")
                }
            }
            if !e.description.isEmpty { Text(e.description).opacity(0.8) }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            if let b = e.backdrop, knownBackdrops.contains(b) {
                Surface(backdrop: b, tint: nil)
            } else {
                Surface(backdrop: groupLook.backdrop, tint: groupLook.tint)
            }
        }
        .clipShape(.rect(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
    }

    private var manageMenu: some View {
        Menu {
            if let e = event {
                Toggle("Andre kan foreslå tidspunkt", isOn: Binding(
                    get: { e.allowTimeSuggestions ?? false },
                    set: { v in Task { await update(["allow_time_suggestions": .bool(v)]) } }
                ))
            }
            if !isArchived {
                Button { editingDetails = true } label: { Label("Rediger", systemImage: "pencil") }
            }
            Button { editingBackdrop = true } label: { Label("Bakgrunn", systemImage: "paintpalette") }
            Divider()
            if isArchived {
                Button { Task { await update(["archived_at": .null]) } } label: { Label("Hent tilbake fra arkivet", systemImage: "tray.and.arrow.up") }
            } else {
                Button { Task { await update(["archived_at": .string(ISO8601DateFormatter().string(from: .now))]) } } label: {
                    Label("Arkiver", systemImage: "archivebox")
                }
            }
            Button(role: .destructive) { confirmDelete = true } label: { Label("Slett arrangementet", systemImage: "trash") }
        } label: {
            Image(systemName: "ellipsis")
        }
        .accessibilityLabel("Administrer arrangementet")
    }

    private var backdropSheet: some View {
        NavigationStack {
            ScrollView {
                BackdropPicker(
                    selection: Binding(
                        get: { event?.backdrop.flatMap { knownBackdrops.contains($0) ? $0 : nil } },
                        set: { v in Task { await update(["backdrop": v.map(AnyJSON.string) ?? .null]) } }
                    ),
                    inherit: (groupLook.backdrop, groupLook.tint)
                )
                .padding()
            }
            .navigationTitle("Bakgrunn")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { Button("Ferdig") { editingBackdrop = false } }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: Stemming

    @ViewBuilder private var voting: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Tidspunkter").font(.title2.bold())
                Spacer()
                if canSuggest && event?.chosenOptionId == nil {
                    Button { suggesting = true } label: { Label("Foreslå", systemImage: "plus") }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                }
            }
            if let uid = auth.userId, !options.isEmpty {
                let answered = options.filter { o in o.eventVotes.contains { $0.userId == uid } }.count
                let voters = Set(options.flatMap { $0.eventVotes.map(\.userId) }).count
                Text("Du har svart på \(answered) av \(options.count) · \(voters) av \(members.count) har svart")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            if options.isEmpty {
                Text("Ingen tidspunkter er foreslått ennå.").foregroundStyle(.secondary)
            }
            ForEach(options) { o in
                OptionCard(
                    option: o,
                    myAnswer: o.eventVotes.first { $0.userId == auth.userId }?.answer,
                    isChosen: o.id == event?.chosenOptionId,
                    locked: event?.chosenOptionId != nil || isArchived,
                    names: names,
                    onVote: { answer in Task { await vote(o.id, answer) } }
                )
                .contextMenu { optionMenu(o) }
                .overlay(alignment: .topTrailing) {
                    if canManage && !isArchived {
                        Menu { optionMenu(o) } label: {
                            Image(systemName: "ellipsis.circle").font(.title3).padding(10).contentShape(.rect)
                        }
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Valg for tidspunktet")
                    }
                }
            }
            if let error { Text(error).font(.callout).foregroundStyle(.red) }
        }
    }

    @ViewBuilder private func optionMenu(_ o: TimeOption) -> some View {
        if canManage && !isArchived {
            if o.id == event?.chosenOptionId {
                Button { Task { await choose(nil) } } label: { Label("Angre valget", systemImage: "arrow.uturn.backward") }
            } else if event?.chosenOptionId == nil {
                Button { confirmChoose = o } label: { Label("Velg dette tidspunktet", systemImage: "checkmark.seal") }
            }
        }
        if (canManage || o.createdBy == auth.userId) && o.id != event?.chosenOptionId && !isArchived {
            Button(role: .destructive) { Task { await removeOption(o.id) } } label: { Label("Fjern tidspunktet", systemImage: "trash") }
        }
    }

    // MARK: Data

    private func load() async {
        do {
            async let detail: EventDetail = supabase.from("events")
                .select("id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by, allow_time_suggestions, archived_at")
                .eq("id", value: eventId).single().decoded()
            async let g: EventGroupRow = supabase.from("events").select("group_id, groups(tint, backdrop)").eq("id", value: eventId).single().decoded()
            async let opts: [TimeOption] = supabase.from("event_time_options")
                .select("id, starts_at, created_by, event_votes(option_id, user_id, answer)")
                .eq("event_id", value: eventId).order("starts_at").decoded()
            let row = try await g
            async let mem: [Member] = supabase.from("group_members")
                .select("user_id, role, profiles(id, display_name, avatar_url)")
                .eq("group_id", value: row.groupId).order("joined_at").decoded()
            event = try await detail
            groupId = row.groupId
            groupLook = (row.groups?.tint, row.groups?.backdrop)
            options = try await opts
            members = (try? await mem) ?? []
            await loadTasks()
            error = nil
        } catch {
            if event == nil { self.error = "Kunne ikke hente arrangementet." }
        }
    }

    private func loadTasks() async {
        if let t: [EventTask] = try? await supabase.from("event_tasks")
            .select("id, title, assignee_id, status, created_by")
            .eq("event_id", value: eventId).order("created_at").decoded() {
            tasks = t
        }
    }

    /// Stemmer, tidspunkter, oppgaver og selve arrangementet oppdateres i sanntid.
    private func listen() async {
        guard channel == nil else { return }
        let ch = supabase.channel("event:\(eventId.uuidString.lowercased())")
        let votes = ch.postgresChange(AnyAction.self, schema: "public", table: "event_votes")
        let opts = ch.postgresChange(AnyAction.self, schema: "public", table: "event_time_options", filter: .eq("event_id", value: eventId))
        let taskChanges = ch.postgresChange(AnyAction.self, schema: "public", table: "event_tasks", filter: .eq("event_id", value: eventId))
        let eventChanges = ch.postgresChange(AnyAction.self, schema: "public", table: "events", filter: .eq("id", value: eventId))
        channel = ch
        try? await ch.subscribeWithError()
        await withTaskGroup(of: Void.self) { group in
            group.addTask { for await _ in votes { await load() } }
            group.addTask { for await _ in opts { await load() } }
            group.addTask { for await _ in taskChanges { await loadTasks() } }
            group.addTask { for await _ in eventChanges { await load() } }
        }
    }

    /// Trykk på valgt svar igjen fjerner stemmen (som på web).
    private func vote(_ optionId: UUID, _ answer: VoteAnswer) async {
        guard let uid = auth.userId, let i = options.firstIndex(where: { $0.id == optionId }) else { return }
        let before = options
        let current = options[i].eventVotes.first { $0.userId == uid }?.answer
        options[i].eventVotes.removeAll { $0.userId == uid }
        do {
            if current == answer {
                try await supabase.from("event_votes").delete()
                    .eq("option_id", value: optionId).eq("user_id", value: uid).execute()
            } else {
                options[i].eventVotes.append(Vote(optionId: optionId, userId: uid, answer: answer))
                try await supabase.from("event_votes").upsert([
                    "option_id": optionId.uuidString.lowercased(),
                    "user_id": uid.uuidString.lowercased(),
                    "answer": answer.rawValue,
                ]).execute()
            }
            error = nil
        } catch {
            options = before
            self.error = "Kunne ikke lagre svaret. Prøv igjen."
        }
    }

    /// Et medlem foreslår et tidspunkt og stemmer automatisk «Passer» på det.
    private func suggest(_ date: Date) async -> String? {
        guard let uid = auth.userId else { return "Du må være innlogget." }
        guard date > .now else { return "Tidspunktet har allerede vært." }
        struct Created: Decodable { let id: UUID }
        do {
            let created: Created = try await supabase.from("event_time_options")
                .insert(["event_id": eventId.uuidString.lowercased(), "starts_at": ISO8601DateFormatter().string(from: date)])
                .select("id").single().decoded()
            _ = try? await supabase.from("event_votes").upsert([
                "option_id": created.id.uuidString.lowercased(),
                "user_id": uid.uuidString.lowercased(),
                "answer": "yes",
            ]).execute()
            await load()
            return nil
        } catch let e as PostgrestError where e.code == "23505" {
            return "Det tidspunktet er allerede foreslått."
        } catch let e as PostgrestError where e.code == "42501" {
            return "Forslag er stengt for dette arrangementet."
        } catch {
            return "Kunne ikke legge til forslaget."
        }
    }

    private func choose(_ optionId: UUID?) async {
        await update([
            "chosen_option_id": optionId.map { .string($0.uuidString.lowercased()) } ?? .null,
            "status": .string(optionId == nil ? "planning" : "scheduled"),
        ])
    }

    private func removeOption(_ id: UUID) async {
        _ = try? await supabase.from("event_time_options").delete().eq("id", value: id).execute()
        await load()
    }

    @discardableResult
    private func update(_ patch: [String: AnyJSON]) async -> Bool {
        do {
            let rows: [EventDetail] = try await supabase.from("events").update(patch).eq("id", value: eventId)
                .select("id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by, allow_time_suggestions, archived_at")
                .decoded()
            if let e = rows.first { event = e; return true }
            error = "Bare arrangøren eller en admin kan endre dette."
        } catch {
            self.error = "Kunne ikke lagre endringen."
        }
        return false
    }

    private func deleteEvent() async {
        let rows: [EventDetail]? = try? await supabase.from("events").delete().eq("id", value: eventId)
            .select("id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by, allow_time_suggestions, archived_at")
            .decoded()
        if rows?.isEmpty == false {
            if !router.path.isEmpty { router.path.removeLast() }
        } else {
            error = "Bare arrangøren eller en admin kan slette."
        }
    }
}

nonisolated private struct EventGroupRow: Decodable {
    struct Look: Decodable { let tint: String?; let backdrop: String? }
    let groupId: UUID
    let groups: Look?
}

struct SuggestTimeSheet: View {
    let existing: [Date]
    let onSubmit: (Date) async -> String?
    @Environment(\.dismiss) private var dismiss
    @State private var date: Date = {
        let d = Calendar.current.date(byAdding: .day, value: 1, to: .now)!
        return Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: d) ?? d
    }()
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Tidspunkt", selection: $date, in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
                    .environment(\.locale, Locale(identifier: "nb_NO"))
                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Foreslå tidspunkt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Legger til …" : "Foreslå") {
                        Task {
                            busy = true
                            error = await onSubmit(date)
                            busy = false
                            if error == nil { dismiss() }
                        }
                    }
                    .disabled(busy)
                }
            }
        }
    }
}

struct OptionCard: View {
    let option: TimeOption
    let myAnswer: VoteAnswer?
    let isChosen: Bool
    let locked: Bool
    let names: [UUID: String]
    let onVote: (VoteAnswer) -> Void
    @State private var showVoters = false

    private func count(_ a: VoteAnswer) -> Int { option.eventVotes.filter { $0.answer == a }.count }

    var body: some View {
        let p = Fmt.parts(option.startsAt)
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(spacing: 0) {
                    Text(p.weekday).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    Text(p.day).font(.title2.bold())
                    Text(p.month).font(.caption2).foregroundStyle(.secondary)
                }
                .frame(width: 52, height: 60)
                .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
                .accessibilityElement(children: .combine)
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("kl. \(p.time)").font(.headline)
                        if isChosen {
                            Text("Valgt").font(.caption.bold()).foregroundStyle(.white)
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background(.green, in: .capsule)
                        }
                    }
                    ResultBar(yes: count(.yes), maybe: count(.maybe), no: count(.no))
                    Button { withAnimation { showVoters.toggle() } } label: {
                        HStack(spacing: 4) {
                            Text("\(count(.yes)) passer · \(count(.maybe)) kanskje · \(count(.no)) passer ikke")
                            Image(systemName: "chevron.down").rotationEffect(.degrees(showVoters ? 180 : 0))
                        }
                        .font(.caption).foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Viser hvem som har svart")
                }
                .padding(.trailing, 28)
            }
            if showVoters { voters }
            if locked {
                if let myAnswer { Text("Du svarte «\(myAnswer.label)»").font(.caption).foregroundStyle(.secondary) }
            } else {
                HStack(spacing: 6) {
                    ForEach(VoteAnswer.allCases, id: \.self) { a in
                        Button { onVote(a) } label: {
                            Label(a.label, systemImage: a.symbol)
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity, minHeight: 40)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(myAnswer == a ? Color.white : .primary)
                        .background(myAnswer == a ? color(a) : Color(.tertiarySystemFill), in: .rect(cornerRadius: 10))
                        .accessibilityAddTraits(myAnswer == a ? .isSelected : [])
                    }
                }
                .sensoryFeedback(.selection, trigger: myAnswer)
            }
        }
        .padding(16)
        .card()
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(isChosen ? Color.green : .clear, lineWidth: 2))
        .opacity(locked && !isChosen ? 0.6 : 1)
    }

    private var voters: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(VoteAnswer.allCases, id: \.self) { a in
                let who = option.eventVotes.filter { $0.answer == a }.map { names[$0.userId] ?? "Medlem" }
                if !who.isEmpty {
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: a.symbol).foregroundStyle(color(a)).frame(width: 16)
                        Text(who.joined(separator: ", ")).font(.caption)
                    }
                }
            }
            let missing = names.keys.filter { id in !option.eventVotes.contains { $0.userId == id } }.map { names[$0] ?? "" }.sorted()
            if !missing.isEmpty {
                HStack(alignment: .top, spacing: 6) {
                    Image(systemName: "circle.dashed").foregroundStyle(.secondary).frame(width: 16)
                    Text("Ikke svart: " + missing.joined(separator: ", ")).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 12))
    }

    private func color(_ a: VoteAnswer) -> Color {
        switch a { case .yes: .green; case .maybe: .orange; case .no: .gray }
    }
}

struct ResultBar: View {
    let yes: Int, maybe: Int, no: Int

    var body: some View {
        let total = max(yes + maybe + no, 1)
        GeometryReader { geo in
            HStack(spacing: 2) {
                Rectangle().fill(.green).frame(width: geo.size.width * CGFloat(yes) / CGFloat(total))
                Rectangle().fill(.orange).frame(width: geo.size.width * CGFloat(maybe) / CGFloat(total))
                Rectangle().fill(.gray.opacity(0.5)).frame(width: geo.size.width * CGFloat(no) / CGFloat(total))
            }
        }
        .frame(height: 6)
        .background(Color(.tertiarySystemFill))
        .clipShape(.capsule)
        .accessibilityHidden(true)
    }
}
