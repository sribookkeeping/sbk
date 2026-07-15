import SwiftUI

/// Everything that doesn't need a top-level tab: events, schedules, reports,
/// payouts, notifications, family, and account/settings.
struct MoreView: View {
    @Environment(AppState.self) private var app
    @State private var unread = 0

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        NotificationsView()
                    } label: {
                        Label("Notifications", systemImage: "bell.fill")
                            .badge(unread)
                    }
                    NavigationLink {
                        EventsView()
                    } label: {
                        Label("Events & Planning", systemImage: "party.popper.fill")
                    }
                    NavigationLink {
                        SchedulesListView()
                    } label: {
                        Label("Schedules", systemImage: "calendar.badge.clock")
                    }
                    NavigationLink {
                        ReportsView()
                    } label: {
                        Label("Reports", systemImage: "chart.bar.fill")
                    }
                    NavigationLink {
                        PayoutsView()
                    } label: {
                        Label("Payouts", systemImage: "banknote.fill")
                    }
                    NavigationLink {
                        FamilyListView()
                    } label: {
                        Label("Family", systemImage: "person.3.fill")
                    }
                }

                Section {
                    LabeledContent("Signed in as") {
                        Text("\(app.member?.emoji ?? "") \(app.member?.name ?? "")")
                    }
                    LabeledContent("Family", value: app.family?.name ?? "")
                    LabeledContent("Server", value: API.shared.serverURLString)
                    Button("Sign out", role: .destructive) { app.logout() }
                } header: {
                    Text("Account")
                } footer: {
                    Text("One backend, one database — this app and the website always show the same family ledger.")
                }
            }
            .navigationTitle("More")
            .task {
                if let response: NotificationsResponse = try? await API.shared.get("/api/v1/notifications") {
                    unread = response.unread
                }
            }
        }
    }
}

struct NotificationsView: View {
    @State private var notifications: [NotificationDTO] = []
    @State private var errorMessage: String?

    var body: some View {
        List {
            if notifications.isEmpty {
                Text("No notifications yet.").foregroundStyle(.secondary)
            }
            ForEach(notifications) { notification in
                VStack(alignment: .leading, spacing: 2) {
                    Text(notification.title)
                        .font(.body.weight(notification.readAt == nil ? .semibold : .regular))
                    Text(notification.body)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(notification.createdAt.shortDateTime)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            ErrorText(message: errorMessage)
        }
        .navigationTitle("Notifications")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Mark all read") {
                    perform($errorMessage) {
                        let _: [String: Bool] = try await API.shared.send("POST", "/api/v1/notifications")
                        await load()
                    }
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        do {
            let response: NotificationsResponse = try await API.shared.get("/api/v1/notifications")
            notifications = response.notifications
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct SchedulesListView: View {
    @State private var schedules: [ScheduleDTO] = []
    @State private var errorMessage: String?

    var body: some View {
        List {
            if schedules.isEmpty {
                Text("No schedules yet — create them on the website or from a chore.")
                    .foregroundStyle(.secondary)
            }
            ForEach(schedules) { schedule in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(schedule.choreTitle).font(.body.weight(.medium))
                        Spacer()
                        StatusBadge(
                            text: schedule.status.replacingOccurrences(of: "_", with: " ").capitalized,
                            color: schedule.status == "ACTIVE" ? .green
                                : schedule.status == "PENDING_APPROVAL" ? .orange : .gray)
                    }
                    Text(schedule.description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(schedule.assignees.isEmpty
                         ? "🙋 Open — anyone can claim each occurrence"
                         : "👤 " + schedule.assignees.map(\.name).joined(separator: ", "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            ErrorText(message: errorMessage)
        }
        .navigationTitle("Schedules")
        .refreshable { await load() }
        .task { await load() }
    }

    private func load() async {
        do {
            let response: SchedulesResponse = try await API.shared.get("/api/v1/schedules")
            schedules = response.schedules
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct ReportsView: View {
    @Environment(AppState.self) private var app
    @State private var report: ReportResponse?
    @State private var days = 30
    @State private var errorMessage: String?

    private let frequencies = ["NONE", "DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"]

    var body: some View {
        List {
            Section("📬 Email reports") {
                Picker("Frequency", selection: Binding(
                    get: { report?.reportFrequency ?? "MONTHLY" },
                    set: { setFrequency($0) }
                )) {
                    ForEach(frequencies, id: \.self) { value in
                        Text(value.replacingOccurrences(of: "_", with: "-").capitalized).tag(value)
                    }
                }
            }

            Section("Balance sheet") {
                Picker("Period", selection: $days) {
                    Text("7 days").tag(7)
                    Text("30 days").tag(30)
                    Text("90 days").tag(90)
                    Text("1 year").tag(365)
                }
                .pickerStyle(.segmented)

                ForEach(report?.members ?? []) { summary in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(summary.emoji) \(summary.name)")
                            .font(.body.weight(.medium))
                        HStack {
                            Text("\(summary.choresCompleted) chores · earned \(money(summary.earnedCents)) · spent \(money(summary.spentCents)) · paid out \(money(summary.paidOutCents))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text("Net \(money(summary.netCents)) · All-time balance \(money(summary.allTimeBalanceCents))")
                            .font(.caption.weight(.semibold))
                    }
                }
                if let totals = report?.totals {
                    LabeledContent("Family net") {
                        Text(money(totals.netCents)).fontWeight(.bold)
                    }
                }
            }
            ErrorText(message: errorMessage)
        }
        .navigationTitle("Reports")
        .task(id: days) { await load() }
        .refreshable { await load() }
    }

    private func setFrequency(_ value: String) {
        perform($errorMessage) {
            struct Response: Codable { let reportFrequency: String }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/reports", json: ["frequency": value])
            await load()
        }
    }

    private func load() async {
        do {
            report = try await API.shared.get("/api/v1/reports?days=\(days)")
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct PayoutsView: View {
    @Environment(AppState.self) private var app
    @State private var payouts: [PayoutDTO] = []
    @State private var recipientId = ""
    @State private var amount = ""
    @State private var note = ""
    @State private var errorMessage: String?

    var body: some View {
        List {
            if app.isParent {
                Section("💵 Record a payout") {
                    Picker("To", selection: $recipientId) {
                        ForEach(app.family?.members ?? []) { member in
                            Text("\(member.emoji) \(member.name)").tag(member.id)
                        }
                    }
                    TextField("Amount ($)", text: $amount)
                        .decimalKeyboard()
                    TextField("Note (optional)", text: $note)
                    ErrorText(message: errorMessage)
                    Button("Record Payout") { record() }
                        .disabled(parseCents(amount) == nil || recipientId.isEmpty)
                }
            }

            Section("History") {
                if payouts.isEmpty {
                    Text("No payouts yet. balance = earned − spent − paid out.")
                        .foregroundStyle(.secondary)
                }
                ForEach(payouts) { payout in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(payout.memberName).font(.body.weight(.medium))
                            Text("\(payout.createdAt.shortDate) · by \(payout.paidByName ?? "?")\(payout.note.isEmpty ? "" : " · \(payout.note)")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(money(payout.amountCents)).fontWeight(.semibold)
                    }
                }
            }
        }
        .navigationTitle("Payouts")
        .refreshable { await load() }
        .task {
            recipientId = app.family?.members.first?.id ?? ""
            await load()
        }
    }

    private func record() {
        guard let cents = parseCents(amount) else { return }
        perform($errorMessage) {
            struct Response: Codable {
                struct P: Codable { let id: String }
                let payout: P
            }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/payouts",
                json: ["memberId": recipientId, "amountCents": cents, "note": note.trimmed])
            amount = ""
            note = ""
            await load()
        }
    }

    private func load() async {
        do {
            let response: PayoutsResponse = try await API.shared.get("/api/v1/payouts")
            payouts = response.payouts
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct FamilyListView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        List {
            Section(app.family?.name ?? "Family") {
                ForEach(app.family?.members ?? []) { member in
                    HStack {
                        AvatarView(emoji: member.emoji, isParent: member.isParent, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(member.name)\(member.isHead ? " 👑" : "")")
                                .font(.body.weight(.medium))
                            Text("\(member.roleLabel)\(member.email.map { " · \($0)" } ?? " · no sign-in yet")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            Section {
                Text("Add or manage members, PINs, and passwords on the website — changes appear here instantly (same database).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Family")
        .refreshable { await app.refreshFamily() }
    }
}
