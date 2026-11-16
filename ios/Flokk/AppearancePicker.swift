import SwiftUI

enum Backdrops {
    static let groups: [(label: String, items: [(key: String, label: String)])] = [
        ("Årstider", [("var", "Vår"), ("sommer", "Sommer"), ("host", "Høst"), ("vinter", "Vinter")]),
        ("Sport", [("fotball", "Fotball"), ("ski", "Ski"), ("sykkel", "Sykkel")]),
        ("Musikk", [("noter", "Noter"), ("piano", "Piano"), ("lydbolger", "Lydbølger")]),
        ("Mat og drikke", [("kaffe", "Kaffe"), ("sitrus", "Sitrus"), ("urter", "Urter")]),
        ("Aktiviteter", [("friluftsliv", "Friluftsliv"), ("boker", "Bøker"), ("reise", "Reise")]),
    ]
    static let tints: [(key: String, label: String)] = [
        ("mint", "Mint"), ("lime", "Lime"), ("sky", "Himmel"), ("lilac", "Syrin"), ("mauve", "Lyng"), ("peach", "Fersken"),
    ]
}

/// Rutenett med bakgrunner. `inherit` gir en første flis «Som flokken» (verdi nil).
struct BackdropPicker: View {
    @Binding var selection: String?
    var inherit: (backdrop: String?, tint: String?)?
    var tint: String?

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let inherit {
                tile(label: "Som flokken", selected: selection == nil) {
                    Surface(backdrop: inherit.backdrop, tint: inherit.tint)
                } action: { selection = nil }
                .frame(maxWidth: 140)
            } else {
                tile(label: "Bare farge", selected: selection == nil) {
                    Tint.color(tint)
                } action: { selection = nil }
                .frame(maxWidth: 140)
            }
            ForEach(Backdrops.groups, id: \.label) { group in
                VStack(alignment: .leading, spacing: 8) {
                    Text(group.label).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    LazyVGrid(columns: columns, spacing: 10) {
                        ForEach(group.items, id: \.key) { item in
                            tile(label: item.label, selected: selection == item.key) {
                                Surface(backdrop: item.key, tint: nil)
                            } action: { selection = item.key }
                        }
                    }
                }
            }
        }
    }

    private func tile<V: View>(label: String, selected: Bool, @ViewBuilder preview: () -> V, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Color.clear
                    .frame(height: 52)
                    .frame(maxWidth: .infinity)
                    .overlay { preview() }
                    .clipShape(.rect(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? Color.primary : .secondary.opacity(0.2), lineWidth: selected ? 2.5 : 1))
                Text(label).font(.caption2).foregroundStyle(selected ? .primary : .secondary)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct TintPicker: View {
    @Binding var selection: String

    var body: some View {
        HStack(spacing: 12) {
            ForEach(Backdrops.tints, id: \.key) { t in
                Button { selection = t.key } label: {
                    Circle().fill(Tint.color(t.key))
                        .frame(width: 34, height: 34)
                        .overlay(Circle().stroke(selection == t.key ? Color.primary : .clear, lineWidth: 2.5).padding(-4))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(t.label)
                .accessibilityAddTraits(selection == t.key ? .isSelected : [])
            }
        }
        .padding(.vertical, 4)
    }
}
