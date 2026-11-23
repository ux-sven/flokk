import Supabase
import SwiftUI

// Rapportering og blokkering (migrasjon 16, 20261123120000_reports_and_blocks.sql).
// Blokkering skjuler meldinger på serveren (RLS) og stopper varsler fra brukeren.

enum ReportReason: String, CaseIterable, Identifiable {
    case inappropriate, harassment, spam, other
    var id: String { rawValue }
    var label: String {
        switch self {
        case .inappropriate: "Upassende eller støtende innhold"
        case .harassment: "Trakassering eller mobbing"
        case .spam: "Spam eller svindel"
        case .other: "Noe annet"
        }
    }
}

/// Hva som rapporteres: en melding, eller en bruker i en flokk.
struct ReportTarget: Identifiable {
    enum Kind: String { case message, user }
    let kind: Kind
    let id: UUID
    let groupId: UUID
    let name: String
}

enum Moderation {
    static func block(_ userId: UUID) async throws {
        do {
            try await supabase.from("user_blocks").insert(["blocked_id": userId.uuidString.lowercased()]).execute()
        } catch let e as PostgrestError where e.code == "23505" {
            // Allerede blokkert
        }
    }

    static func unblock(_ userId: UUID) async throws {
        try await supabase.from("user_blocks").delete().eq("blocked_id", value: userId.uuidString.lowercased()).execute()
    }

    static func report(_ target: ReportTarget, reason: ReportReason, details: String) async throws {
        let trimmed = details.trimmingCharacters(in: .whitespacesAndNewlines)
        let params: [String: String?] = [
            "report_kind": target.kind.rawValue,
            "target": target.id.uuidString.lowercased(),
            "gid": target.groupId.uuidString.lowercased(),
            "report_reason": reason.rawValue,
            "report_details": trimmed.isEmpty ? nil : trimmed,
        ]
        _ = try await supabase.rpc("report_content", params: params).execute()
    }
}

/// Skjema for å rapportere en melding eller bruker.
struct ReportSheet: View {
    let target: ReportTarget
    @Environment(\.dismiss) private var dismiss
    @State private var reason: ReportReason = .inappropriate
    @State private var details = ""
    @State private var busy = false
    @State private var error: String?
    @State private var sent = false

    var body: some View {
        NavigationStack {
            Form {
                if sent {
                    Section {
                        Label("Takk! Rapporten er sendt, og vi ser på den innen et døgn.", systemImage: "checkmark.circle.fill")
                    } footer: {
                        Text("Vil du slippe å se mer fra \(target.name), kan du også blokkere fra «⋯»-menyen.")
                    }
                } else {
                    Section("Hva er galt?") {
                        Picker("Årsak", selection: $reason) {
                            ForEach(ReportReason.allCases) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.inline)
                        .labelsHidden()
                    }
                    Section {
                        TextField("Fortell gjerne mer (valgfritt)", text: $details, axis: .vertical)
                            .lineLimit(3...6)
                    } footer: {
                        if let error { Text(error).foregroundStyle(.red) }
                        else { Text("Rapporten går til Flokk, ikke til \(target.name).") }
                    }
                }
            }
            .navigationTitle(target.kind == .message ? "Rapporter meldingen" : "Rapporter \(target.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(sent ? "Ferdig" : "Avbryt") { dismiss() }
                }
                if !sent {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(busy ? "Sender …" : "Send") { Task { await send() } }.disabled(busy)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func send() async {
        busy = true
        defer { busy = false }
        do {
            try await Moderation.report(target, reason: reason, details: details)
            sent = true
            error = nil
        } catch {
            self.error = "Kunne ikke sende rapporten. Prøv igjen."
        }
    }
}

/// Brukere du har blokkert (på profilen), med mulighet til å oppheve.
struct BlockedUsersSection: View {
    nonisolated struct Row: Decodable, Identifiable {
        let blockedId: UUID
        let profiles: Profile?
        var id: UUID { blockedId }
        var name: String { (profiles?.displayName).flatMap { $0.isEmpty ? nil : $0 } ?? "Bruker" }
    }

    @State private var rows: [Row] = []

    var body: some View {
        Section {
            if rows.isEmpty {
                Text("Du har ikke blokkert noen.").foregroundStyle(.secondary)
            }
            ForEach(rows) { r in
                HStack {
                    Text(r.name)
                    Spacer()
                    Button("Opphev") { Task { await unblock(r) } }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                }
            }
        } header: {
            Text("Blokkerte brukere")
        } footer: {
            Text("Du blokkerer eller rapporterer noen ved å holde fingeren på en melding, eller fra «⋯» i medlemslisten.")
        }
        .task { await load() }
    }

    private func load() async {
        if let r: [Row] = try? await supabase.from("user_blocks")
            .select("blocked_id, profiles!user_blocks_blocked_id_fkey(id, display_name, avatar_url)")
            .decoded() {
            rows = r
        }
    }

    private func unblock(_ r: Row) async {
        if (try? await Moderation.unblock(r.blockedId)) != nil {
            rows.removeAll { $0.id == r.id }
        }
    }
}
