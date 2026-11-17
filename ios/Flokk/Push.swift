import Foundation
import Observation
import Supabase
import UIKit
import UserNotifications

/// Holder styr på varseltillatelse og sender enhetens APNs-token til Supabase
/// (tabellen device_tokens), slik at Edge Function «send-push» kan nå telefonen.
@Observable
final class PushManager {
    static let shared = PushManager()

    private(set) var status: UNAuthorizationStatus = .notDetermined
    private(set) var lastError: String?
    /// Telefonen er registrert hos Flokk og kan få push
    private(set) var registered = false
    private var token: String?

    /// Utviklingsbygg bruker Apples sandkasse, App Store/TestFlight bruker produksjon.
    private var environment: String {
        #if DEBUG
        "sandbox"
        #else
        "production"
        #endif
    }

    func refreshStatus() async {
        status = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
        if status == .authorized || status == .provisional || status == .ephemeral {
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    /// Spør om lov (systemdialogen vises bare én gang).
    func requestPermission() async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
        await refreshStatus()
    }

    func didRegister(deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        token = hex
        Task { await upload() }
    }

    func didFailToRegister(_ error: Error) {
        lastError = error.localizedDescription
    }

    /// Kalles etter innlogging og når tokenet endres.
    func upload() async {
        guard let token, (try? await supabase.auth.session) != nil else { return }
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        do {
            try await supabase.rpc("register_device_token", params: [
                "device_token": token,
                "device_platform": "ios",
                "device_environment": environment,
                "device_app_version": version,
            ]).execute()
            registered = true
            lastError = nil
        } catch {
            lastError = "Kunne ikke registrere telefonen for varsler."
        }
    }

    /// Ved utlogging skal ikke telefonen få flere varsler for denne brukeren.
    func unregister() async {
        registered = false
        guard let token else { return }
        _ = try? await supabase.from("device_tokens").delete().eq("token", value: token).execute()
    }

    /// Ber send-push sende et testvarsel til alle enhetene dine og forteller hva som skjedde.
    func sendTest() async -> String {
        do {
            let r: PushTestResult = try await supabase.functions.invoke(
                "send-push",
                options: FunctionInvokeOptions(body: ["test": true])
            )
            guard let channels = r.channels else {
                return "Serveren kjører en eldre versjon av send-push. Deploy funksjonen på nytt."
            }
            if channels.ios != true {
                return "Push til iOS er ikke satt opp på serveren. Sjekk APNS_-hemmelighetene og deploy send-push på nytt."
            }
            let sent = r.sent ?? 0
            let devices = r.devices ?? 0
            var text = devices == 0
                ? "Ingen enheter er registrert for varsler."
                : "Testvarsel sendt til \(sent) av \(devices) enhet\(devices == 1 ? "" : "er")."
            if let f = r.failures, !f.isEmpty { text += " Feil: " + f.joined(separator: "; ") }
            return text
        } catch {
            return "Kunne ikke sende testvarsel."
        }
    }

    func setBadge(_ count: Int) {
        UNUserNotificationCenter.current().setBadgeCount(count)
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushManager.shared.didRegister(deviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushManager.shared.didFailToRegister(error)
    }

    /// Vis varselet også når appen er åpen – men ikke for chatten man allerede ser på.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        let target = PushTarget(userInfo: notification.request.content.userInfo)
        let viewing = await MainActor.run {
            NotificationCenterModel.shared.bump()
            return Router.shared.isViewing(target)
        }
        return viewing ? [] : [.banner, .list, .sound]
    }

    /// Trykk på varselet åpner riktig flokk, arrangement eller chat.
    /// NB: Bruk varianten med completion handler, ikke `async`. Med `async` kalles
    /// svaret til iOS fra en bakgrunnstråd, og UIKit avbryter appen
    /// («Call must be made on main thread» i _performBlockAfterCATransactionCommitSynchronizes).
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        if let target = PushTarget(userInfo: response.notification.request.content.userInfo) {
            Task { @MainActor in Router.shared.open(target) }
        }
        completionHandler()
    }
}

/// Det et varsel peker på (fra APNs-nyttelasten eller varsellisten).
nonisolated struct PushTarget: Equatable, Sendable {
    let groupId: UUID
    let eventId: UUID?
    let isMessage: Bool

    init(groupId: UUID, eventId: UUID?, isMessage: Bool) {
        self.groupId = groupId
        self.eventId = eventId
        self.isMessage = isMessage
    }

    init?(userInfo: [AnyHashable: Any]) {
        guard let g = (userInfo["group_id"] as? String).flatMap(UUID.init(uuidString:)) else { return nil }
        groupId = g
        eventId = (userInfo["event_id"] as? String).flatMap(UUID.init(uuidString:))
        isMessage = (userInfo["kind"] as? String) == "message"
    }
}

nonisolated struct PushTestResult: Decodable {
    struct Channels: Decodable { let web: Bool?; let ios: Bool?; let android: Bool? }
    let sent: Int?
    let devices: Int?
    let channels: Channels?
    let failures: [String]?
}
