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

/// Samme dempede pastellfarger som webappen (konvertert fra OKLCH).
enum Tint {
    static func color(_ name: String?) -> Color {
        switch name {
        case "lime": Color(light: (0.859, 0.873, 0.726), dark: (0.241, 0.248, 0.151))
        case "sky": Color(light: (0.761, 0.847, 0.900), dark: (0.173, 0.239, 0.285))
        case "lilac": Color(light: (0.827, 0.792, 0.903), dark: (0.240, 0.214, 0.291))
        case "mauve": Color(light: (0.876, 0.791, 0.844), dark: (0.270, 0.208, 0.248))
        case "peach": Color(light: (0.936, 0.840, 0.735), dark: (0.308, 0.233, 0.161))
        default: Color(light: (0.759, 0.869, 0.816), dark: (0.171, 0.250, 0.214))
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

    /// Fylt knapp i aksentfargen (grafitt i lys modus, gull i mørk) med lesbar tekst på begge.
    /// Bruk denne i stedet for .borderedProminent, som alltid gir hvit tekst.
    func prominentButton() -> some View {
        buttonStyle(.borderedProminent).foregroundStyle(Color("OnAccent"))
    }
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
