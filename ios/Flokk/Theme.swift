import SwiftUI
import UIKit

extension Color {
    init(light: (Double, Double, Double), dark: (Double, Double, Double)) {
        self.init(uiColor: UIColor { traits in
            let c = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: 1)
        })
    }
}

/// Samme pastellfarger som webappen (konvertert fra OKLCH).
enum Tint {
    static func color(_ name: String?) -> Color {
        switch name {
        case "lime": Color(light: (0.843, 0.962, 0.641), dark: (0.263, 0.331, 0.124))
        case "sky": Color(light: (0.685, 0.86, 0.967), dark: (0.139, 0.301, 0.39))
        case "lilac": Color(light: (0.822, 0.713, 0.955), dark: (0.321, 0.234, 0.416))
        case "mauve": Color(light: (0.778, 0.767, 0.879), dark: (0.279, 0.267, 0.361))
        case "peach": Color(light: (1, 0.813, 0.687), dark: (0.402, 0.267, 0.173))
        default: Color(light: (0.641, 0.894, 0.822), dark: (0.115, 0.322, 0.274))
        }
    }
}

let knownBackdrops: Set<String> = [
    "var", "sommer", "host", "vinter", "fotball", "ski", "sykkel", "noter", "piano",
    "lydbolger", "kaffe", "sitrus", "urter", "friluftsliv", "boker", "reise",
]

/// Flate for flokk/arrangement: bakgrunnsbilde hvis valgt, ellers pastellfarge.
struct Surface: View {
    let backdrop: String?
    let tint: String?
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        if let b = backdrop, knownBackdrops.contains(b) {
            Image("backdrop-\(b)")
                .resizable()
                .scaledToFill()
                .overlay(scheme == .dark ? Color.black.opacity(0.55) : Color.clear)
        } else {
            Tint.color(tint)
        }
    }
}

struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 24))
            .shadow(color: .black.opacity(0.07), radius: 10, y: 4)
    }
}

extension View {
    func card() -> some View { modifier(CardStyle()) }
}

struct AvatarView: View {
    let name: String
    var url: String?
    var size: CGFloat = 36
    var online = false

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let url, let u = URL(string: url) {
                    AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { fallback }
                } else {
                    fallback
                }
            }
            .frame(width: size, height: size)
            .clipShape(.circle)
            if online {
                Circle().fill(.green)
                    .frame(width: size * 0.32, height: size * 0.32)
                    .overlay(Circle().stroke(Color(.secondarySystemGroupedBackground), lineWidth: 2))
                    .accessibilityLabel("inne nå")
            }
        }
    }

    private var fallback: some View {
        Tint.color("mint").overlay(
            Text(initials(name)).font(.system(size: size * 0.36, weight: .semibold))
        )
    }
}
