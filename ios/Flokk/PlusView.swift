import RevenueCat
import SwiftUI

/// Kjøpsskjermen for Flokk Pluss.
struct PlusView: View {
    /// Hvorfor kjøpsskjermen vises, f.eks. «Du eier allerede 3 flokker …»
    var reason: String?
    @Environment(\.dismiss) private var dismiss
    @State private var store = PlusStore.shared
    @State private var packages: [Package] = []
    @State private var selected: Package?
    @State private var loading = true
    @State private var busy = false
    @State private var message: String?
    @State private var done = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if let reason {
                        Label(reason, systemImage: "lock.fill")
                            .font(.callout.weight(.medium))
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.tint.opacity(0.12), in: .rect(cornerRadius: 14))
                    }
                    header
                    benefits
                    if done {
                        Label("Velkommen til Flokk Pluss!", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.tint)
                    } else if loading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else if packages.isEmpty {
                        Text("Flokk Pluss kommer snart.")
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        options
                        buy
                    }
                    if let message {
                        Text(message).font(.callout).foregroundStyle(.secondary)
                    }
                    if !packages.isEmpty && !done { finePrint }
                }
                .padding(20)
            }
            .background(Color(.systemGroupedBackground))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(done ? "Ferdig" : "Lukk") { dismiss() }
                }
            }
        }
        .task { await load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "sparkles")
                .font(.system(size: 34))
                .foregroundStyle(.tint)
            Text("Flokk Pluss").font(.largeTitle.bold())
            Text("Ingen grenser for flokkene du eier. Medlemmene betaler ingenting.")
                .foregroundStyle(.secondary)
        }
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 12) {
            benefit("person.3.fill", "Så mange flokker du vil", "Gratis: 3")
            benefit("person.crop.circle.badge.plus", "Ubegrenset antall medlemmer", "Gratis: 8 per flokk")
            benefit("calendar.badge.plus", "Planlegg flere arrangementer samtidig", "Gratis: 1 kommende om gangen")
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func benefit(_ icon: String, _ title: String, _ free: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon).foregroundStyle(.tint).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold))
                Text(free).font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private var options: some View {
        VStack(spacing: 10) {
            ForEach(packages, id: \.identifier) { p in
                Button { selected = p } label: { OptionRow(package: p, selected: selected?.identifier == p.identifier) }
                    .buttonStyle(.plain)
            }
        }
    }

    private var buy: some View {
        VStack(spacing: 12) {
            Button {
                Task { await purchase() }
            } label: {
                Text(busy ? "Venter på App Store …" : buttonTitle)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .prominentButton()
            .buttonBorderShape(.capsule)
            .controlSize(.large)
            .disabled(busy || selected == nil)

            Button("Gjenopprett kjøp") { Task { await restore() } }
                .font(.callout)
                .disabled(busy)
        }
    }

    private var buttonTitle: String {
        guard let s = selected else { return "Velg et alternativ" }
        if s.storeProduct.introductoryDiscount?.paymentMode == .freeTrial { return "Prøv gratis" }
        return s.packageType == .lifetime ? "Kjøp for \(s.storeProduct.localizedPriceString)" : "Abonner"
    }

    private var finePrint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Abonnementet fornyes automatisk til samme pris med mindre du sier det opp senest 24 timer før perioden er over. Betalingen trekkes fra Apple-kontoen din. Du kan si opp når som helst under Innstillinger → [navnet ditt] → Abonnementer. Livstid er et engangskjøp.")
            HStack(spacing: 16) {
                Link("Vilkår", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                Link("Personvern", destination: siteURL("/personvern"))
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func load() async {
        defer { loading = false }
        do {
            packages = try await store.packages()
            selected = packages.first { $0.packageType == .annual } ?? packages.first
        } catch {
            message = "Kunne ikke hente prisene fra App Store. Prøv igjen senere."
        }
    }

    private func purchase() async {
        guard let selected else { return }
        busy = true
        defer { busy = false }
        do {
            if try await store.purchase(selected) {
                done = true
                message = nil
            }
        } catch {
            message = "Kjøpet ble ikke gjennomført. Du er ikke belastet."
        }
    }

    private func restore() async {
        busy = true
        defer { busy = false }
        do {
            if try await store.restore() {
                done = true
                message = nil
            } else {
                message = "Fant ingen kjøp av Flokk Pluss på denne Apple-kontoen."
            }
        } catch {
            message = "Kunne ikke gjenopprette kjøp. Prøv igjen senere."
        }
    }
}

private struct OptionRow: View {
    let package: Package
    let selected: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                .font(.title3)
                .foregroundStyle(selected ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title).font(.body.weight(.semibold))
                    if package.packageType == .annual {
                        Text("Mest populær")
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(.tint.opacity(0.15), in: .capsule)
                    }
                }
                if let detail { Text(detail).font(.footnote).foregroundStyle(.secondary) }
            }
            Spacer()
            Text(price).font(.body.weight(.semibold)).monospacedDigit()
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 18))
        .overlay {
            RoundedRectangle(cornerRadius: 18).strokeBorder(selected ? AnyShapeStyle(.tint) : AnyShapeStyle(.clear), lineWidth: 2)
        }
        .contentShape(.rect)
    }

    private var product: StoreProduct { package.storeProduct }

    private var title: String {
        switch package.packageType {
        case .annual: "Årlig"
        case .monthly: "Månedlig"
        case .lifetime: "Livstid"
        default: product.localizedTitle
        }
    }

    private var price: String {
        switch package.packageType {
        case .annual: "\(product.localizedPriceString)/år"
        case .monthly: "\(product.localizedPriceString)/mnd"
        default: product.localizedPriceString
        }
    }

    private var detail: String? {
        var parts: [String] = []
        if let trial = product.introductoryDiscount, trial.paymentMode == .freeTrial {
            parts.append("\(trialLength(trial.subscriptionPeriod)) gratis")
        }
        switch package.packageType {
        case .annual: if let m = product.localizedPricePerMonth { parts.append("\(m)/mnd") }
        case .lifetime: parts.append("Betal én gang")
        default: break
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func trialLength(_ p: SubscriptionPeriod) -> String {
        switch p.unit {
        case .day: p.value == 7 ? "1 uke" : "\(p.value) dager"
        case .week: p.value == 1 ? "1 uke" : "\(p.value) uker"
        case .month: p.value == 1 ? "1 måned" : "\(p.value) måneder"
        case .year: "1 år"
        @unknown default: "Prøveperiode"
        }
    }
}
