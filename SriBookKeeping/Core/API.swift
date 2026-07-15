import Foundation
import Security

// MARK: - Keychain (token storage)

enum Keychain {
    private static let service = "com.gosula.SriBookKeeping"

    static func save(_ value: String, for key: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - API client

struct APIError: LocalizedError {
    let message: String
    let status: Int

    var errorDescription: String? { message }
}

private struct ErrorBody: Decodable {
    let error: String?
}

/// Talks to the shared backend (the same one the website uses) with the
/// bearer token from POST /api/v1/auth/login. One backend, one database —
/// two interfaces.
final class API {
    static let shared = API()

    var baseURL: URL {
        let raw = UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3000"
        return URL(string: raw) ?? URL(string: "http://localhost:3000")!
    }

    var serverURLString: String {
        get { UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:3000" }
        set { UserDefaults.standard.set(newValue, forKey: "serverURL") }
    }

    var token: String? {
        get { Keychain.read("apiToken") }
        set {
            if let newValue { Keychain.save(newValue, for: "apiToken") } else { Keychain.delete("apiToken") }
        }
    }

    /// Absolute URL for API-relative image paths (receipts, proofs) with the
    /// token as a query fallback isn't supported — use authorizedData instead.
    func url(_ path: String) -> URL {
        URL(string: path, relativeTo: baseURL) ?? baseURL
    }

    // MARK: request plumbing

    private func makeRequest(_ method: String, _ path: String, body: Data?, contentType: String?) -> URLRequest {
        var request = URLRequest(url: url(path))
        request.httpMethod = method
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
        request.httpBody = body
        return request
    }

    private func run<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            throw APIError(message: message ?? "Request failed (\(status))", status: status)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await run(makeRequest("GET", path, body: nil, contentType: nil))
    }

    func send<T: Decodable>(_ method: String, _ path: String, json object: [String: Any?] = [:]) async throws -> T {
        let cleaned = object.compactMapValues { $0 }
        let body = try JSONSerialization.data(withJSONObject: cleaned)
        return try await run(makeRequest(method, path, body: body, contentType: "application/json"))
    }

    /// multipart/form-data upload (receipts, completion proofs).
    func upload<T: Decodable>(
        _ path: String,
        fields: [String: String],
        fileField: String,
        fileData: Data,
        filename: String = "photo.jpg",
        mimeType: String = "image/jpeg"
    ) async throws -> T {
        let boundary = "sbk-\(UUID().uuidString)"
        var body = Data()
        func append(_ string: String) { body.append(Data(string.utf8)) }
        for (key, value) in fields {
            append("--\(boundary)\r\n")
            append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n")
        }
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(filename)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        append("\r\n--\(boundary)--\r\n")

        return try await run(
            makeRequest("POST", path, body: body, contentType: "multipart/form-data; boundary=\(boundary)"))
    }

    /// Fetches an auth-gated image (receipt / proof photo).
    func authorizedData(_ path: String) async throws -> Data {
        let (data, response) = try await URLSession.shared.data(for: makeRequest("GET", path, body: nil, contentType: nil))
        guard ((response as? HTTPURLResponse)?.statusCode ?? 0) < 300 else {
            throw APIError(message: "Image unavailable", status: 404)
        }
        return data
    }
}
