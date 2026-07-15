import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        Group {
            if app.isRestoring {
                ProgressView("Signing in…")
            } else if app.isLoggedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .task {
            NotificationManager.requestAuthorization()
            await app.restoreSession()
        }
    }
}

/// Signs in against the same backend as the website — one account, one
/// family ledger, two interfaces.
struct LoginView: View {
    @Environment(AppState.self) private var app
    @State private var email = ""
    @State private var password = ""
    @State private var serverURL = API.shared.serverURLString
    @State private var errorMessage: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 8) {
                        Text("🏡").font(.system(size: 56))
                        Text("SriBookKeeping")
                            .font(.title2.bold())
                        Text("Sign in with the same account you use on the website.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }

                Section("Account") {
                    TextField("Email", text: $email)
                        .textContentType(.username)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        #endif
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                    ErrorText(message: errorMessage)
                }

                Section {
                    Button {
                        signIn()
                    } label: {
                        if busy {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In").frame(maxWidth: .infinity).fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || email.trimmed.isEmpty || password.isEmpty)
                    .listRowBackground(Color.clear)
                } footer: {
                    Text("Forgot your password or username? Use \"Forgot password\" / \"Find my account\" on the website — it emails you a reset link. New family? Register on the website first.")
                }

                Section("Server") {
                    TextField("Server URL", text: $serverURL)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        #endif
                        .onChange(of: serverURL) { _, newValue in
                            API.shared.serverURLString = newValue.trimmed
                        }
                    Text("The iPhone app and the website share this backend and database.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Sign In")
        }
    }

    private func signIn() {
        busy = true
        errorMessage = nil
        Task {
            defer { busy = false }
            do {
                try await app.login(email: email.trimmed.lowercased(), password: password)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
