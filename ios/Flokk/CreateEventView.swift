import Supabase
import SwiftUI

/// Neste hele time minst én dag frem i tid, kl. 18 som utgangspunkt.
private func defaultStart() -> Date {
    var cal = Calendar.current
    cal.timeZone = TimeZone(identifier: "Europe/Oslo")!
    let tomorrow = cal.date(byAdding: .day, value: 1, to: .now)!
    return cal.date(bySettingHour: 18, minute: 0, second: 0, of: tomorrow) ?? tomorrow
}

struct CreateEventView: View {
    let group: FlokkGroup
    var onCreated: (UUID) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var location = ""
    @State private var place: Place?
    @State private var suggestions: [Place] = []
    @State private var options: [Date] = [defaultStart()]
    @State private var allowSuggestions = true
    @State private var backdrop: String?
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tittel", text: $title).font(.title3.weight(.semibold))
                    TextField("Beskrivelse (valgfritt)", text: $description, axis: .vertical).lineLimit(2...5)
                }

                Section {
                    TextField("Adresse, sted eller fritekst", text: $location)
                        .textContentType(.fullStreetAddress)
                        .onChange(of: location) { _, v in if v != place?.label { place = nil } }
                    if place != nil {
                        Label("Lenker til kart", systemImage: "mappin.circle.fill").font(.caption).foregroundStyle(.green)
                    }
                    ForEach(place == nil ? suggestions : []) { s in
                        Button {
                            place = s
                            location = s.label
                            suggestions = []
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(s.label).foregroundStyle(.primary)
                                Text(s.detail).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: { Text("Sted") } footer: {
                    Text("Velg et forslag for å lenke til kart, eller skriv hva du vil.")
                }
                .task(id: location) { await search() }

                Section {
                    ForEach(options.indices, id: \.self) { i in
                        HStack {
                            DatePicker("Forslag \(i + 1)", selection: $options[i], in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                                .environment(\.locale, Locale(identifier: "nb_NO"))
                            if options.count > 1 {
                                Button(role: .destructive) { options.remove(at: i) } label: {
                                    Image(systemName: "minus.circle.fill").foregroundStyle(.red)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Fjern forslag \(i + 1)")
                            }
                        }
                    }
                    Button {
                        let last = options.last ?? defaultStart()
                        options.append(Calendar.current.date(byAdding: .day, value: 1, to: last) ?? last)
                    } label: { Label("Legg til tidspunkt", systemImage: "plus.circle.fill") }
                    Toggle("Andre kan foreslå tidspunkt", isOn: $allowSuggestions)
                } header: { Text("Forslag til tidspunkt") } footer: {
                    Text("Flokken stemmer på forslagene. Du velger det endelige tidspunktet.")
                }

                Section("Bakgrunn") {
                    BackdropPicker(selection: $backdrop, inherit: (group.backdrop, group.tint))
                        .padding(.vertical, 6)
                }

                if let error { Section { Text(error).foregroundStyle(.red) } }
            }
            .navigationTitle("Nytt arrangement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Lager …" : "Lag") { Task { await create() } }
                        .disabled(busy || title.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
        }
    }

    private func search() async {
        guard place == nil else { suggestions = []; return }
        try? await Task.sleep(for: .milliseconds(250))
        guard !Task.isCancelled else { return }
        if let hits = try? await Places.search(location) { suggestions = hits }
    }

    private func create() async {
        let cleanTitle = title.trimmingCharacters(in: .whitespaces)
        guard cleanTitle.count >= 2 else { error = "Gi arrangementet en tittel."; return }
        let starts = Array(Set(options.map { Int($0.timeIntervalSince1970 / 60) })).sorted()
            .map { ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: TimeInterval($0 * 60))) }
        guard !starts.isEmpty else { error = "Legg til minst ett forslag til tidspunkt."; return }
        busy = true
        error = nil

        struct NewEvent: Encodable {
            let group_id: UUID
            let title: String
            let description: String
            let location: String?
            let location_lat: Double?
            let location_lng: Double?
            let allow_time_suggestions: Bool
            let backdrop: String?
        }
        struct Created: Decodable { let id: UUID }
        let loc = location.trimmingCharacters(in: .whitespaces)
        do {
            let created: Created = try await supabase.from("events").insert(NewEvent(
                group_id: group.id,
                title: cleanTitle,
                description: description.trimmingCharacters(in: .whitespacesAndNewlines),
                location: loc.isEmpty ? nil : String(loc.prefix(200)),
                location_lat: loc.isEmpty ? nil : place?.lat,
                location_lng: loc.isEmpty ? nil : place?.lng,
                allow_time_suggestions: allowSuggestions,
                backdrop: backdrop
            )).select("id").single().decoded()
            do {
                try await supabase.from("event_time_options")
                    .insert(starts.map { ["event_id": created.id.uuidString.lowercased(), "starts_at": $0] })
                    .execute()
            } catch {
                self.error = "Arrangementet ble opprettet, men tidsforslagene feilet."
            }
            dismiss()
            onCreated(created.id)
        } catch {
            self.error = planLimitMessage(error) ?? "Kunne ikke opprette arrangementet."
        }
        busy = false
    }
}
