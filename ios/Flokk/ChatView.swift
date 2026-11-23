import SwiftUI
import Supabase

struct ChatView: View {
    let groupId: UUID
    let eventId: UUID?
    @Environment(AuthModel.self) private var auth
    @Environment(Router.self) private var router
    @State private var names: [UUID: String] = [:]
    @State private var messages: [Message] = []
    @State private var text = ""
    @State private var sending = false
    @State private var channel: RealtimeChannelV2?
    @State private var reporting: ReportTarget?
    @State private var blocking: (id: UUID, name: String)?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if messages.isEmpty {
                        Text("Ingen meldinger ennå. Si hei!").foregroundStyle(.secondary).padding(.top, 40)
                    }
                    ForEach(messages) { m in
                        bubble(m).id(m.id)
                            .contextMenu {
                                if m.authorId != auth.userId {
                                    let name = names[m.authorId] ?? "Medlem"
                                    Button { reporting = ReportTarget(kind: .message, id: m.id, groupId: groupId, name: name) } label: {
                                        Label("Rapporter meldingen", systemImage: "flag")
                                    }
                                    Button(role: .destructive) { blocking = (m.authorId, name) } label: {
                                        Label("Blokker \(name)", systemImage: "hand.raised")
                                    }
                                }
                            }
                    }
                }
                .padding()
            }
            .defaultScrollAnchor(.bottom)
            .onChange(of: messages.last?.id) { _, id in
                if let id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
            }
        }
        .safeAreaInset(edge: .bottom) { inputBar }
        .sheet(item: $reporting) { ReportSheet(target: $0) }
        .alert(
            "Blokkere \(blocking?.name ?? "")?",
            isPresented: Binding(get: { blocking != nil }, set: { if !$0 { blocking = nil } }),
            presenting: blocking
        ) { b in
            Button("Blokker", role: .destructive) {
                Task {
                    try? await Moderation.block(b.id)
                    messages.removeAll { $0.authorId == b.id }
                }
            }
            Button("Avbryt", role: .cancel) {}
        } message: { b in
            Text("Du ser ikke lenger meldingene til \(b.name) og får ikke varsler om det \(b.name) gjør. \(b.name) får ikke vite det. Du kan oppheve det under Profil.")
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(eventId == nil ? "Gruppechat" : "Chat for arrangementet")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarVisibility(.hidden, for: .tabBar)
        .task { await load(); await listen() }
        .onAppear { router.visibleChat = (groupId, eventId) }
        .onDisappear {
            router.visibleChat = nil
            if let channel { Task { await supabase.removeChannel(channel) } }
        }
    }

    private func bubble(_ m: Message) -> some View {
        let mine = m.authorId == auth.userId
        let name = names[m.authorId] ?? "Medlem"
        return HStack(alignment: .bottom, spacing: 8) {
            if mine { Spacer(minLength: 48) } else { AvatarView(name: name, size: 28) }
            VStack(alignment: mine ? .trailing : .leading, spacing: 2) {
                if !mine { Text(name).font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                Text(m.body)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .foregroundStyle(mine ? Color(.systemBackground) : .primary)
                    .background(mine ? Color.primary : Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
                Text(Fmt.messageTime(m.createdAt)).font(.caption2).foregroundStyle(.tertiary)
            }
            if !mine { Spacer(minLength: 48) }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Skriv en melding …", text: $text, axis: .vertical)
                .lineLimit(1...5)
                .padding(.horizontal, 14).padding(.vertical, 10)
                .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
            Button { Task { await send() } } label: {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 34))
            }
            .disabled(sending || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal).padding(.vertical, 8)
        .background(.bar)
    }

    private func load() async {
        if names.isEmpty, let members: [Member] = try? await supabase.from("group_members")
            .select("user_id, role, profiles(id, display_name, avatar_url)")
            .eq("group_id", value: groupId).decoded() {
            names = Dictionary(uniqueKeysWithValues: members.map { ($0.userId, $0.name) })
        }
        var q = supabase.from("messages")
            .select("id, group_id, event_id, author_id, body, created_at")
            .eq("group_id", value: groupId)
        q = eventId.map { q.eq("event_id", value: $0) } ?? q.is("event_id", value: nil)
        if let rows: [Message] = try? await q.order("created_at", ascending: false).limit(50).decoded() {
            messages = rows.reversed()
        }
    }

    private func listen() async {
        guard channel == nil else { return }
        let ch = supabase.channel("messages:\(groupId.uuidString.lowercased()):\(eventId?.uuidString.lowercased() ?? "group")")
        let inserts = ch.postgresChange(InsertAction.self, schema: "public", table: "messages", filter: .eq("group_id", value: groupId))
        channel = ch
        try? await ch.subscribeWithError()
        for await insert in inserts {
            guard let m = try? insert.decodeRecord(as: Message.self, decoder: flokkDecoder) else { continue }
            if m.eventId == eventId, !messages.contains(where: { $0.id == m.id }) { messages.append(m) }
        }
    }

    private func send() async {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        sending = true
        var row: [String: String?] = ["group_id": groupId.uuidString.lowercased(), "body": body]
        row["event_id"] = .some(eventId?.uuidString.lowercased())
        if let m: Message = try? await supabase.from("messages").insert(row)
            .select("id, group_id, event_id, author_id, body, created_at").single().decoded() {
            text = ""
            if !messages.contains(where: { $0.id == m.id }) { messages.append(m) }
        }
        sending = false
    }
}
