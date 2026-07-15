import SwiftUI

struct MainTabView: View {
    @Environment(AppState.self) private var app
    @State private var approvalsBadge = 0

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Home", systemImage: "house.fill") }

            ChoresView()
                .tabItem { Label("Chores", systemImage: "checklist") }

            ApprovalsView(badge: $approvalsBadge)
                .tabItem { Label("Approvals", systemImage: "checkmark.seal.fill") }
                .badge(approvalsBadge)

            ExpensesView()
                .tabItem { Label("Expenses", systemImage: "creditcard.fill") }

            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle.fill") }
        }
        .task { await refreshBadge() }
    }

    private func refreshBadge() async {
        if let response: ApprovalsResponse = try? await API.shared.get("/api/v1/approvals") {
            approvalsBadge = response.requests.filter { $0.canDecide }.count
        }
    }
}

struct DashboardView: View {
    @Environment(AppState.self) private var app
    @State private var dashboard: DashboardResponse?
    @State private var errorMessage: String?

    private var myBalance: MemberBalanceDTO? {
        guard let id = app.member?.id else { return nil }
        return dashboard?.balances[id]
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 6) {
                        Text("My Balance")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(money(myBalance?.balanceCents ?? 0))
                            .font(.system(size: 42, weight: .bold, design: .rounded))
                            .foregroundStyle((myBalance?.balanceCents ?? 0) < 0 ? .red : .primary)
                        if let pending = myBalance?.pendingExtraCents, pending > 0 {
                            Text("+\(money(pending)) extra pay awaiting approval")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                        HStack(spacing: 24) {
                            Label(money(myBalance?.earnedCents ?? 0), systemImage: "arrow.up.circle.fill")
                                .foregroundStyle(.green)
                            Label(money(myBalance?.spentCents ?? 0), systemImage: "arrow.down.circle.fill")
                                .foregroundStyle(.red)
                            Label(money(myBalance?.paidOutCents ?? 0), systemImage: "banknote")
                                .foregroundStyle(.secondary)
                        }
                        .font(.caption)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }

                Section("My open chores") {
                    let open = dashboard?.openAssignments ?? []
                    if open.isEmpty {
                        Text("Nothing on your plate — pick up a chore to start earning!")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(open) { assignment in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(assignment.choreTitle ?? "Chore")
                                    .font(.body.weight(.medium))
                                if let due = assignment.dueDate {
                                    Text("Due \(due.shortDateTime)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Text(money(assignment.baseAmountCents))
                                .foregroundStyle(.green)
                                .fontWeight(.semibold)
                        }
                    }
                }

                if app.isAdult, let family = app.family, let balances = dashboard?.balances {
                    Section("Family balances") {
                        ForEach(family.members) { member in
                            HStack {
                                AvatarView(emoji: member.emoji, isParent: member.isParent, size: 32)
                                Text(member.name)
                                Spacer()
                                let cents = balances[member.id]?.balanceCents ?? 0
                                Text(money(cents))
                                    .fontWeight(.semibold)
                                    .foregroundStyle(cents < 0 ? .red : .green)
                            }
                        }
                    }
                }

                if let errorMessage {
                    Section { ErrorText(message: errorMessage) }
                }
            }
            .navigationTitle("Hi, \(app.member?.name ?? "")")
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        do {
            let response: DashboardResponse = try await API.shared.get("/api/v1/dashboard")
            dashboard = response
            errorMessage = nil
            NotificationManager.sync(
                openAssignments: response.openAssignments,
                memberName: app.member?.name ?? "You")
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
