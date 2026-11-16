import SwiftUI
import Supabase

struct EventView: View {
    let eventId: UUID
    @Environment(AuthModel.self) private var auth
    @State private var event: EventDetail?
    @State private var groupId: UUID?
    @State private var groupLook: (tint: String?, backdrop: String?) = (nil, nil)
    @State private var options: [TimeOption] = []
    @State private var members: [Member] = []
    @State private var error: String?
    @State private var votesChannel: RealtimeChannelV2?

    private var names: [UUID: String] { Dictionary(uniqueKeysWithValues: members.map { ($0.userId, $0.name) }) }
    private var chosen: TimeOption? { options.first { $0.id == event?.chosenOptionId } }

    var body: some View {
        ScrollView {
            if let event {
                VStack(alignment: .leading, spacing: 24) {
                    header(event)
                    voting
                    if let groupId {
                        NavigationLink {
                            ChatView(groupId: groupId, eventId: event.id, title: "Chat for arrangementet", names: names)
                        } label: {
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
        .overlay { if event == nil && error == nil { ProgressView() } }
        .refreshable { await load() }
        .task { await load(); await listenForVotes() }
        .onDisappear { if let votesChannel { Task { await supabase.removeChannel(votesChannel) } } }
    }

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

    @ViewBuilder private var voting: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Tidspunkter").font(.title2.bold())
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
                    locked: event?.chosenOptionId != nil,
                    names: names,
                    onVote: { answer in Task { await vote(o.id, answer) } }
                )
            }
            if let error { Text(error).font(.callout).foregroundStyle(.red) }
        }
    }

    private func load() async {
        do {
            struct Look: Decodable { let tint: String?; let backdrop: String? }
            struct Row: Decodable { let groupId: UUID; let groups: Look? }
            let detail: EventDetail = try await supabase.from("events")
                .select("id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by")
                .eq("id", value: eventId).single().decoded()
            let g: Row = try await supabase.from("events").select("group_id, groups(tint, backdrop)").eq("id", value: eventId).single().decoded()
            async let opts: [TimeOption] = supabase.from("event_time_options")
                .select("id, starts_at, created_by, event_votes(option_id, user_id, answer)")
                .eq("event_id", value: eventId).order("starts_at").decoded()
            async let mem: [Member] = supabase.from("group_members")
                .select("user_id, role, profiles(id, display_name, avatar_url)")
                .eq("group_id", value: g.groupId).order("joined_at").decoded()
            event = detail
            groupId = g.groupId
            groupLook = (g.groups?.tint, g.groups?.backdrop)
            options = try await opts
            members = (try? await mem) ?? []
            error = nil
        } catch {
            self.error = "Kunne ikke hente arrangementet."
        }
    }

    private func listenForVotes() async {
        guard votesChannel == nil else { return }
        let ch = supabase.channel("votes:\(eventId.uuidString.lowercased())")
        let changes = ch.postgresChange(AnyAction.self, schema: "public", table: "event_votes")
        votesChannel = ch
        try? await ch.subscribeWithError()
        let ids = Set(options.map(\.id))
        for await _ in changes where !ids.isEmpty {
            await load()
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
}

struct OptionCard: View {
    let option: TimeOption
    let myAnswer: VoteAnswer?
    let isChosen: Bool
    let locked: Bool
    let names: [UUID: String]
    let onVote: (VoteAnswer) -> Void

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
                    Text("\(count(.yes)) passer · \(count(.maybe)) kanskje · \(count(.no)) passer ikke")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
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
