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
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        guard let target = PushTarget(userInfo: response.notification.request.content.userInfo) else { return }
        await MainActor.run { Router.shared.open(target) }
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
