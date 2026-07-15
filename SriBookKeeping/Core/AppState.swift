import Foundation
import Observation

/// Session state: who is signed in (token lives in the Keychain) and the
/// family roster, refreshed from GET /api/v1/me.
@Observable
final class AppState {
    var member: MemberDTO?
    var family: FamilyDTO?
    var isRestoring = true

    var isLoggedIn: Bool { member != nil }
    var isParent: Bool { member?.isParent ?? false }
    var isAdult: Bool { member?.isAdult ?? false }

    func restoreSession() async {
        defer { isRestoring = false }
        guard API.shared.token != nil else { return }
        if let me: MeResponse = try? await API.shared.get("/api/v1/me") {
            member = me.member
            family = me.family
        }
    }

    func login(email: String, password: String) async throws {
        let response: LoginResponse = try await API.shared.send(
            "POST", "/api/v1/auth/login",
            json: ["email": email, "password": password])
        API.shared.token = response.token
        member = response.member
        family = response.family
    }

    func refreshFamily() async {
        if let me: MeResponse = try? await API.shared.get("/api/v1/me") {
            member = me.member
            family = me.family
        }
    }

    func logout() {
        API.shared.token = nil
        member = nil
        family = nil
        NotificationManager.cancelAll()
    }

    func memberName(_ id: String?) -> String {
        guard let id else { return "Unclaimed" }
        return family?.members.first { $0.id == id }?.name ?? "Someone"
    }
}
