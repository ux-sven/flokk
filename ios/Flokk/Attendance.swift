import EventKit
import EventKitUI
import SwiftUI

extension VoteAnswer {
    /// Etiketter når tidspunktet er valgt og stemmen betyr påmelding.
    var attendanceLabel: String {
        switch self {
        case .yes: "Kommer"
        case .maybe: "Kanskje"
        case .no: "Kommer ikke"
        }
    }
}

/// «Kommer du?» når tidspunktet er valgt. Svaret lagres som stemmen på det
/// valgte tidspunktet, så de som svarte «Passer» står allerede som påmeldt.
struct AttendanceCard: View {
    let option: TimeOption
    let members: [Member]
    let myUserId: UUID?
    var onAnswer: (VoteAnswer) -> Void
    var onAddToCalendar: () -> Void

    private var mine: VoteAnswer? { option.eventVotes.first { $0.userId == myUserId }?.answer }

    private func people(_ a: VoteAnswer?) -> [Member] {
        members.filter { m in
            let v = option.eventVotes.first { $0.userId == m.userId }?.answer
            return v == a
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Kommer du?").font(.title2.bold())
                    Text(Fmt.dateTime(option.startsAt)).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Button(action: onAddToCalendar) { Label("Kalender", systemImage: "calendar.badge.plus") }
                    .buttonStyle(.bordered)
                    .buttonBorderShape(.capsule)
                    .accessibilityLabel("Legg i kalender")
            }
            HStack(spacing: 8) {
                ForEach(VoteAnswer.allCases, id: \.self) { a in
                    Button { onAnswer(a) } label: {
                        Label(a.attendanceLabel, systemImage: a.symbol)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(mine == a ? color(a) : Color(.tertiarySystemFill), in: .rect(cornerRadius: 14))
                            .foregroundStyle(mine == a ? (a == .maybe ? Color.black : Color.white) : Color.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(mine == a ? .isSelected : [])
                }
            }
            ForEach([VoteAnswer.yes, .maybe, .no].map(Optional.some) + [nil], id: \.self) { a in
                let list = people(a)
                if !list.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("\(a?.attendanceLabel ?? "Ikke svart") · \(list.count)")
                            .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(list) { m in
                                    HStack(spacing: 6) {
                                        AvatarView(name: m.name, url: m.profiles?.avatarUrl, size: 22)
                                        Text(m.userId == myUserId ? "Du" : m.name).font(.subheadline)
                                    }
                                    .padding(.vertical, 3).padding(.leading, 3).padding(.trailing, 10)
                                    .background(Color(.tertiarySystemFill), in: .capsule)
                                }
                            }
                        }
                    }
                }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func color(_ a: VoteAnswer) -> Color {
        switch a {
        case .yes: .green
        case .maybe: .yellow
        case .no: Color(.darkGray)
        }
    }
}

/// Systemets «Ny hendelse»-skjerm, ferdig utfylt. Krever ingen kalendertilgang:
/// brukeren lagrer selv (iOS 17+).
struct CalendarEventSheet: UIViewControllerRepresentable {
    let title: String
    let start: Date
    let location: String?
    let notes: String?
    let url: URL?
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(dismiss: { dismiss() }) }

    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let store = EKEventStore()
        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = start.addingTimeInterval(2 * 60 * 60)
        event.location = location
        event.notes = notes
        event.url = url
        event.addAlarm(EKAlarm(relativeOffset: -2 * 60 * 60))
        let vc = EKEventEditViewController()
        vc.eventStore = store
        vc.event = event
        vc.editViewDelegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: EKEventEditViewController, context: Context) {}

    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let dismiss: () -> Void
        init(dismiss: @escaping () -> Void) { self.dismiss = dismiss }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
            dismiss()
        }
    }
}
