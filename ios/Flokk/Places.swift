import Foundation

/// Søk etter norske adresser og stedsnavn i Kartverkets åpne API-er (samme som webappen).
nonisolated struct Place: Identifiable, Hashable, Sendable {
    enum Kind { case address, place }
    let label: String
    let detail: String
    let kind: Kind
    let lat: Double
    let lng: Double
    var id: String { label.lowercased() }
}

nonisolated enum Places {
    private struct AddressResponse: Decodable {
        struct Hit: Decodable {
            struct Point: Decodable { let lat: Double; let lon: Double }
            let adressetekst: String
            let postnummer: String
            let poststed: String
            let kommunenavn: String?
            let representasjonspunkt: Point?
        }
        let adresser: [Hit]
    }

    private struct NameResponse: Decodable {
        struct Hit: Decodable {
            struct Point: Decodable {
                let nord: Double
                let ost: Double
                enum CodingKeys: String, CodingKey { case nord; case ost = "øst" }
            }
            struct Kommune: Decodable { let kommunenavn: String }
            let skrivemate: String
            let navneobjekttype: String
            let kommuner: [Kommune]?
            let representasjonspunkt: Point?
            enum CodingKeys: String, CodingKey {
                case skrivemate = "skrivemåte"
                case navneobjekttype, kommuner, representasjonspunkt
            }
        }
        let navn: [Hit]
    }

    private static func get<T: Decodable>(_ url: String) async throws -> T? {
        guard let u = URL(string: url) else { return nil }
        let (data, response) = try await URLSession.shared.data(from: u)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    private static func titleCase(_ s: String) -> String {
        s.lowercased().split(separator: " ", omittingEmptySubsequences: false).map { word in
            word.split(separator: "-", omittingEmptySubsequences: false).map { $0.prefix(1).uppercased() + $0.dropFirst() }
                .joined(separator: "-")
        }.joined(separator: " ")
    }

    /// Kaster CancellationError hvis oppgaven avbrytes (ny tekst skrevet).
    static func search(_ query: String) async throws -> [Place] {
        let q = query.trimmingCharacters(in: .whitespaces).split(separator: " ").joined(separator: " ")
        guard q.count >= 3 else { return [] }
        let allowed = CharacterSet.urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+=?*"))
        let exactQ = q.addingPercentEncoding(withAllowedCharacters: allowed) ?? q
        let prefixQ = (q + "*").addingPercentEncoding(withAllowedCharacters: allowed) ?? q
        let base = "https://ws.geonorge.no/adresser/v1/sok?treffPerSide=5&utkoordsys=4258&sok="
        let exactURL = base + exactQ
        let prefixURL = base + prefixQ
        let namesURL = "https://api.kartverket.no/stedsnavn/v1/navn?treffPerSide=5&utkoordsys=4258&sok=" + prefixQ

        async let exact: AddressResponse? = get(exactURL)
        async let prefix: AddressResponse? = get(prefixURL)
        async let names: NameResponse? = get(namesURL)
        let (e, p, n) = try await (exact, prefix, names)
        try Task.checkCancellation()

        var out: [Place] = []
        var seen = Set<String>()
        func add(_ place: Place) {
            if seen.insert(place.id).inserted { out.append(place) }
        }
        for a in (e?.adresser ?? []) + (p?.adresser ?? []) {
            guard let pt = a.representasjonspunkt else { continue }
            let poststed = titleCase(a.poststed)
            let kommune = a.kommunenavn.map(titleCase)
            add(Place(
                label: "\(a.adressetekst), \(a.postnummer) \(poststed)",
                detail: kommune.map { $0 != poststed ? "Adresse i \($0)" : "Adresse" } ?? "Adresse",
                kind: .address, lat: pt.lat, lng: pt.lon))
        }
        for h in n?.navn ?? [] {
            guard let pt = h.representasjonspunkt else { continue }
            let kommune = h.kommuner?.first?.kommunenavn
            add(Place(
                label: kommune.map { $0 != h.skrivemate ? "\(h.skrivemate), \($0)" : h.skrivemate } ?? h.skrivemate,
                detail: h.navneobjekttype, kind: .place, lat: pt.nord, lng: pt.ost))
        }
        // Adresser først når søket har husnummer, ellers stedsnavn først
        let hasNumber = q.contains { $0.isNumber }
        let sorted = out.enumerated().sorted { l, r in
            if l.element.kind == r.element.kind { return l.offset < r.offset }
            return (l.element.kind == .address) == hasNumber
        }.map(\.element)
        return Array(sorted.prefix(8))
    }
}
