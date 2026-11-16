import Supabase
import SwiftUI

/// Endre tittel, beskrivelse og sted for et arrangement (arrangør eller admin).
struct EditEventView: View {
    let event: EventDetail
    var onSave: ([String: AnyJSON]) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var title: String
    @State private var description: String
    @State private var location: String
    @State private var place: Place?
    @State private var suggestions: [Place] = []
    @State private var busy = false
    @State private var error: String?

    init(event: EventDetail, onSave: @escaping ([String: AnyJSON]) async -> Bool) {
        self.event = event
        self.onSave = onSave
        _title = State(initialValue: event.title)
        _description = State(initialValue: event.description)
        _location = State(initialValue: event.location ?? "")
        if let l = event.location, let lat = event.locationLat, let lng = event.locationLng {
            _place = State(initialValue: Place(label: l, detail: "", kind: .address, lat: lat, lng: lng))
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Tittel", text: $title).font(.title3.weight(.semibold))
                    TextField("Beskrivelse (valgfritt)", text: $description, axis: .vertical).lineLimit(2...8)
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
                    Text("Tidspunkt endrer du på arrangementet: foreslå nye tider eller velg et annet forslag.")
                }
                .task(id: location) { await search() }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Rediger arrangement")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") { Task { await save() } }
                        .disabled(busy || title.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
        }
    }

    private func search() async {
        guard place == nil, location != event.location else { suggestions = []; return }
        try? await Task.sleep(for: .milliseconds(250))
        guard !Task.isCancelled else { return }
        if let hits = try? await Places.search(location) { suggestions = hits }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        let loc = String(location.trimmingCharacters(in: .whitespaces).prefix(200))
        let ok = await onSave([
            "title": .string(String(title.trimmingCharacters(in: .whitespaces).prefix(120))),
            "description": .string(description.trimmingCharacters(in: .whitespacesAndNewlines)),
            "location": loc.isEmpty ? .null : .string(loc),
            "location_lat": loc.isEmpty ? .null : place.map { .double($0.lat) } ?? .null,
            "location_lng": loc.isEmpty ? .null : place.map { .double($0.lng) } ?? .null,
        ])
        if ok { dismiss() } else { error = "Kunne ikke lagre endringene." }
    }
}
