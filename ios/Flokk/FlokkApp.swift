import SwiftUI

@main
struct FlokkApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var auth = AuthModel()
    @State private var push = PushManager.shared
    @State private var router = Router.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
                .environment(push)
                .environment(router)
                .onOpenURL { router.handle(url: $0) }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    if let url = activity.webpageURL { router.handle(url: url) }
                }
        }
    }
}

struct RootView: View {
    @Environment(AuthModel.self) private var auth

    var body: some View {
        Group {
            if auth.isLoading {
                ProgressView()
            } else if auth.userId == nil {
                LoginView()
            } else {
                MainTabs()
            }
        }
        .animation(.default, value: auth.userId)
    }
}

struct MainTabs: View {
    @Environment(AuthModel.self) private var auth
    @Environment(PushManager.self) private var push
    @Environment(Router.self) private var router
    @Environment(\.scenePhase) private var scenePhase
    @State private var notifications = NotificationCenterModel.shared

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            Tab("Flokker", systemImage: "person.3", value: AppTab.groups) {
                GroupsView()
            }
            Tab("Varsler", systemImage: "bell", value: AppTab.notifications) {
                NotificationsView()
            }
            .badge(notifications.unread)
            Tab("Profil", systemImage: "person.crop.circle", value: AppTab.profile) {
                ProfileView()
            }
        }
        .sheet(isPresented: Binding(
            get: { router.invitationToken != nil },
            set: { if !$0 { router.invitationToken = nil } }
        )) {
            if let token = router.invitationToken { InvitationView(token: token) }
        }
        .task {
            await push.refreshStatus()
            await push.upload()
            if let uid = auth.userId { await notifications.listen(userId: uid) }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task {
                    await push.refreshStatus()
                    await notifications.load()
                }
            }
        }
    }
}
