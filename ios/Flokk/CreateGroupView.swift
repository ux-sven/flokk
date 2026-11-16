import Supabase
import SwiftUI

func slugify(_ input: String) -> String {
    let lowered = input.lowercased()
        .replacingOccurrences(of: "æ", with: "ae")
        .replacingOccurrences(of: "ø", with: "o")
        .replacingOccurrences(of: "å", with: "a")
        .folding(options: .diacriticInsensitive, locale: nil)
    var out = ""
    var dash = false
    for ch in lowered {
        if ch.isASCII && (ch.isLetter || ch.isNumber) {
            out.append(ch)
            dash = false
        } else if !dash && !out.isEmpty {
            out.append("-")
            dash = true
        }
    }
    while out.hasSuffix("-") { out.removeLast() }
    return String(out.prefix(40))
}

struct CreateGroupView: View {
    var onCreated: (FlokkGroup) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var slug = ""
    @State private var slugEdited = false
    @State private var description = ""
    @State private var emoji = ""
    @State private var open = false
    @State private var tint = "mint"
    @State private var backdrop: String? = "sommer"
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        TextField("🪺", text: $emoji)
                            .font(.largeTitle)
                            .multilineTextAlignment(.center)
                            .frame(width: 56)
                            .onChange(of: emoji) { _, v in if v.count > 2 { emoji = String(v.prefix(2)) } }
                            .accessibilityLabel("Ikon (emoji)")
                        TextField("Navn på flokken", text: $name)
                            .font(.title3.weight(.semibold))
                            .onChange(of: name) { _, v in if !slugEdited { slug = slugify(v) } }
                    }
                    TextField("Beskrivelse (valgfritt)", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }
                Section {
                    HStack(spacing: 0) {
                        Text(siteURL("/").host() ?? "").foregroundStyle(.secondary)
                        Text("/").foregroundStyle(.secondary)
                        TextField("adresse", text: $slug)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onChange(of: slug) { _, v in
                                slugEdited = !v.isEmpty && v != slugify(name)
                            }
                    }
                } header: { Text("Adresse") } footer: { Text("Lenken du deler med andre. Bokstaver a–z, tall og bindestrek.") }

                Section {
                    Picker("Hvem kan bli med?", selection: $open) {
                        Text("Kun inviterte").tag(false)
                        Text("Alle med lenken").tag(true)
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: { Text("Hvem kan bli med?") } footer: {
                    Text(open ? "Alle som har lenken kan se flokken og bli med." : "Bare de du sender en invitasjon til kan bli med.")
                }

                Section("Utseende") {
                    Color.clear
                        .frame(height: 90)
                        .overlay { Surface(backdrop: backdrop, tint: tint) }
                        .clipShape(.rect(cornerRadius: 16))
                        .overlay(alignment: .leading) {
                            Text("\(emoji.isEmpty ? "🪺" : emoji) \(name.isEmpty ? "Flokken" : name)")
                                .font(.headline).padding()
                        }
                        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                    TintPicker(selection: $tint)
                    BackdropPicker(selection: $backdrop, tint: tint)
                        .padding(.vertical, 6)
                }

                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Ny flokk")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Avbryt") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(busy ? "Lager …" : "Lag flokk") { Task { await create() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespaces).count < 2)
                }
            }
        }
    }

    private func create() async {
        let cleanName = name.trimmingCharacters(in: .whitespaces)
        let cleanSlug = slugify(slug.isEmpty ? cleanName : slug)
        guard cleanName.count >= 2 else { error = "Gi flokken et navn på minst to tegn."; return }
        guard cleanSlug.count >= 3 else { error = "Adressen må ha minst tre tegn (a–z, 0–9 og bindestrek)."; return }
        busy = true
        error = nil
        var row: [String: String?] = [
            "name": cleanName,
            "slug": cleanSlug,
            "description": description.trimmingCharacters(in: .whitespacesAndNewlines),
            "visibility": open ? "open" : "invite_only",
            "tint": tint,
            "emoji": emoji.isEmpty ? nil : emoji,
        ]
        if let backdrop { row["backdrop"] = backdrop }
        do {
            let g: FlokkGroup = try await supabase.from("groups").insert(row)
                .select("*").single().decoded()
            dismiss()
            onCreated(g)
        } catch let e as PostgrestError where e.code == "23505" {
            error = "Adressen «\(cleanSlug)» er allerede i bruk."
        } catch let e as PostgrestError where e.code == "23514" {
            error = "Adressen «\(cleanSlug)» kan ikke brukes. Velg en annen."
        } catch {
            self.error = "Noe gikk galt. Prøv igjen."
        }
        busy = false
    }
}
