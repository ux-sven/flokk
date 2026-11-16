import SwiftUI
import Supabase

struct ChatView: View {
    let groupId: UUID
    let eventId: UUID?
    let title: String
    let names: [UUID: String]
    @Environment(AuthModel.self) private var auth
    @State private var messages: [Message] = []
    @State private var text = ""
    @State private var sending = false
    @State private var channel: RealtimeChannelV2?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if messages.isEmpty {
                        Text("Ingen meldinger ennå. Si hei!").foregroundStyle(.secondary).padding(.top, 40)
                    }
                    ForEach(messages) { m in bubble(m).id(m.id) }
                }
                .padding()
            }
            .defaultScrollAnchor(.bottom)
            .onChange(of: messages.last?.id) { _, id in
                if let id { withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
            }
        }
        .safeAreaInset(edge: .bottom) { inputBar }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarVisibility(.hidden, for: .tabBar)
        .task { await load(); await listen() }
        .onDisappear { if let channel { Task { await supabase.removeChannel(channel) } } }
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
