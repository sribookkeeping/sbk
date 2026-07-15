import SwiftUI

/// Approval inbox — same rules, same data as the website: pool chores, chore
/// edits/deletes (both parents), schedules (both parents), extra pay, skips.
struct ApprovalsView: View {
    @Binding var badge: Int
    @State private var requests: [ApprovalDTO] = []
    @State private var errorMessage: String?

    private var needsMe: [ApprovalDTO] { requests.filter { $0.canDecide } }
    private var pendingOthers: [ApprovalDTO] {
        requests.filter { $0.status == "PENDING" && !$0.canDecide }
    }
    private var decided: [ApprovalDTO] {
        Array(requests.filter { $0.status != "PENDING" }.prefix(10))
    }

    var body: some View {
        NavigationStack {
            List {
                if !needsMe.isEmpty {
                    Section("Needs your approval") {
                        ForEach(needsMe) { request in
                            row(request, actions: true)
                        }
                    }
                }
                if !pendingOthers.isEmpty {
                    Section("Waiting on others") {
                        ForEach(pendingOthers) { request in
                            row(request, actions: false)
                        }
                    }
                }
                if !decided.isEmpty {
                    Section("Recent decisions") {
                        ForEach(decided) { request in
                            row(request, actions: false)
                        }
                    }
                }
                if requests.isEmpty {
                    Text("Nothing to approve yet.")
                        .foregroundStyle(.secondary)
                }
                ErrorText(message: errorMessage)
            }
            .navigationTitle("Approvals")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    @ViewBuilder
    private func row(_ request: ApprovalDTO, actions: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(request.headline).font(.body.weight(.medium))
                    Text("\(request.requestedBy?.name ?? "Someone") · \(request.createdAt.shortDateTime)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !request.note.isEmpty {
                        Text("Reason: \(request.note)")
                            .font(.caption)
                            .italic()
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    if let amount = request.amountCents, amount > 0 {
                        Text(money(amount))
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.green)
                    }
                    StatusBadge(
                        text: request.status.capitalized,
                        color: request.status == "PENDING" ? .orange
                            : request.status == "APPROVED" ? .green : .red)
                }
            }
            if actions {
                HStack {
                    Button("✓ Approve") { decide(request, "approve") }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                    Button("✕ Reject") { decide(request, "reject") }
                        .buttonStyle(.bordered)
                        .tint(.red)
                }
                .font(.subheadline.weight(.semibold))
            }
        }
        .padding(.vertical, 2)
    }

    private func decide(_ request: ApprovalDTO, _ decision: String) {
        perform($errorMessage) {
            struct Response: Codable { let id: String; let status: String }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/approvals/\(request.id)",
                json: ["decision": decision])
            await load()
        }
    }

    private func load() async {
        do {
            let response: ApprovalsResponse = try await API.shared.get("/api/v1/approvals")
            requests = response.requests
            badge = needsMe.count
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
