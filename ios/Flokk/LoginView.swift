import SwiftUI

struct LoginView: View {
    @Environment(AuthModel.self) private var auth
    @State private var email = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 14) {
                    Image("Logo")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 64)
                        .accessibilityLabel("Flokk")
                    Text("Velkommen tilbake til flokken.").foregroundStyle(.secondary)
                }
                VStack(spacing: 12) {
                    TextField("E-post", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Divider()
                    SecureField("Passord", text: $password)
                        .textContentType(.password)
                }
                .textFieldStyle(.plain)
                .padding(14)
                .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 14))

                if let error {
                    Text(error).font(.callout).foregroundStyle(.red)
                }

                Button {
                    Task { await signIn() }
                } label: {
                    Text(busy ? "Logger inn …" : "Logg inn").frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .prominentButton()
                .buttonBorderShape(.capsule)
                .disabled(busy || email.isEmpty || password.isEmpty)

                HStack {
                    Link("Opprett konto", destination: siteURL("/konto/registrer"))
                    Spacer()
                    Link("Glemt passord?", destination: siteURL("/konto/glemt-passord"))
                }
                .font(.callout)
            }
            .padding(24)
            .padding(.top, 60)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func signIn() async {
        busy = true
        error = nil
        do {
            try await auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
        } catch {
            self.error = "Feil e-post eller passord."
        }
        busy = false
    }
}
