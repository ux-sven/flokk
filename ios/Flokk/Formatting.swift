import Foundation

enum Fmt {
    private static let oslo = TimeZone(identifier: "Europe/Oslo")!
    private static let nb = Locale(identifier: "nb_NO")

    // ISO8601DateFormatter er trådsikker; brukes også fra modellene utenfor MainActor
    nonisolated(unsafe) private static let isoFrac: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    nonisolated(unsafe) private static let iso = ISO8601DateFormatter()

    nonisolated static func date(_ s: String) -> Date? { isoFrac.date(from: s) ?? iso.date(from: s) }

    private static func formatter(_ template: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = nb
        f.timeZone = oslo
        f.setLocalizedDateFormatFromTemplate(template)
        return f
    }
    private static let dateTimeF = formatter("EEEEdMMMMHHmm")
    private static let dateTimeYearF = formatter("EEEEdMMMMyHHmm")
    private static let weekdayF = formatter("EEE")
    private static let monthF = formatter("MMM")
    private static let dayF = formatter("d")
    private static let timeF = formatter("HHmm")

    /// «lørdag 14. november kl. 18:00» – med årstall når datoen ikke er i år.
    static func dateTime(_ s: String) -> String {
        guard let d = date(s) else { return s }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = oslo
        let sameYear = cal.component(.year, from: d) == cal.component(.year, from: .now)
        return (sameYear ? dateTimeF : dateTimeYearF).string(from: d)
    }
    static func parts(_ s: String) -> (weekday: String, day: String, month: String, time: String) {
        guard let d = date(s) else { return ("", "", "", "") }
        return (weekdayF.string(from: d).capitalized, dayF.string(from: d), monthF.string(from: d), timeF.string(from: d))
    }
    private static let shortDateF = formatter("dMMMHHmm")

    /// Klokkeslett for meldinger i dag, ellers «14. nov. 14:55».
    static func messageTime(_ s: String) -> String {
        guard let d = date(s) else { return "" }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = oslo
        return cal.isDateInToday(d) ? timeF.string(from: d) : shortDateF.string(from: d)
    }

    static func time(_ s: String) -> String {
        guard let d = date(s) else { return "" }
        return timeF.string(from: d)
    }
}

func initials(_ name: String) -> String {
    let parts = name.split(separator: " ").prefix(2)
    let s = parts.compactMap(\.first).map(String.init).joined().uppercased()
    return s.isEmpty ? "?" : s
}
