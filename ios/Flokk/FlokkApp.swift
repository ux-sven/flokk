import SwiftUI

@main
struct FlokkApp: App {
    @State private var auth = AuthModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(auth)
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
    var body: some View {
        TabView {
            Tab("Flokker", systemImage: "person.3") {
                GroupsView()
            }
            Tab("Profil", systemImage: "person.crop.circle") {
                ProfileView()
            }
        }
    }
}
