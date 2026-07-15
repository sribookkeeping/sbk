import SwiftUI

/// The chore hub against the shared backend: claim what's up for grabs,
/// complete with photo proof, give up, skip/reschedule, pick up pool chores.
struct ChoresView: View {
    @Environment(AppState.self) private var app
    @State private var data: ChoresResponse?
    @State private var errorMessage: String?
    @State private var completing: AssignmentDTO?
    @State private var skipping: AssignmentDTO?
    @State private var pickingUp: ChoreDTO?
    @State private var showNewChore = false

    private func title(for assignment: AssignmentDTO) -> String {
        data?.chores.first { $0.id == assignment.choreId }?.title ?? "Chore"
    }

    private var upForGrabs: [AssignmentDTO] {
        (data?.pendingAssignments ?? []).filter { $0.isUnclaimed }
    }

    private var mine: [AssignmentDTO] {
        (data?.pendingAssignments ?? []).filter { $0.assigneeId == app.member?.id }
    }

    private var others: [AssignmentDTO] {
        (data?.pendingAssignments ?? []).filter { assignment in
            guard let assignee = assignment.assigneeId else { return false }
            return assignee != app.member?.id && (app.isAdult || assignment.autoAssigned == true)
        }
    }

    private var available: [ChoreDTO] {
        (data?.chores ?? []).filter { $0.isAvailableInPool }
    }

    var body: some View {
        NavigationStack {
            List {
                if !upForGrabs.isEmpty {
                    Section("🙋 Up for grabs — first to claim earns it") {
                        ForEach(upForGrabs) { assignment in
                            assignmentRow(assignment) {
                                Button("Claim It") {
                                    perform($errorMessage) {
                                        struct ClaimResponse: Codable { let assignment: AssignmentDTO }
                                        let _: ClaimResponse = try await API.shared.send(
                                            "POST", "/api/v1/assignments/\(assignment.id)/claim")
                                        await load()
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(.orange)
                            }
                        }
                    }
                }

                Section("My chores") {
                    if mine.isEmpty {
                        Text("No open chores — pick one up below!")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(mine) { assignment in
                        assignmentRow(assignment) {
                            Button("Complete") { completing = assignment }
                                .buttonStyle(.borderedProminent)
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Give Up", role: .destructive) {
                                perform($errorMessage) {
                                    let _: [String: Bool] = try await API.shared.send(
                                        "POST", "/api/v1/assignments/\(assignment.id)/giveup")
                                    await load()
                                }
                            }
                            Button("Skip…") { skipping = assignment }
                                .tint(.indigo)
                        }
                    }
                }

                Section("Available chores") {
                    if available.isEmpty {
                        Text("The chore pool is empty.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(available) { chore in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(chore.title).font(.body.weight(.medium))
                                if !chore.details.isEmpty {
                                    Text(chore.details)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            Spacer()
                            Text(money(chore.amountCents))
                                .foregroundStyle(.green)
                                .fontWeight(.semibold)
                            Button("Pick Up") { pickingUp = chore }
                                .buttonStyle(.bordered)
                        }
                    }
                }

                if !others.isEmpty {
                    Section("Family chores in progress") {
                        ForEach(others) { assignment in
                            assignmentRow(assignment) {
                                if assignment.autoAssigned == true {
                                    Button("Take Over") {
                                        perform($errorMessage) {
                                            struct ClaimResponse: Codable { let assignment: AssignmentDTO }
                                            let _: ClaimResponse = try await API.shared.send(
                                                "POST", "/api/v1/assignments/\(assignment.id)/claim")
                                            await load()
                                        }
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                        }
                    }
                }

                Section {
                    ErrorText(message: errorMessage)
                }
            }
            .navigationTitle("Chores")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showNewChore = true
                    } label: {
                        Label("New Chore", systemImage: "plus")
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
            .sheet(item: $completing) { assignment in
                CompleteChoreSheet(assignment: assignment, choreTitle: title(for: assignment)) {
                    await load()
                }
            }
            .sheet(item: $skipping) { assignment in
                SkipSheet(assignment: assignment, choreTitle: title(for: assignment)) {
                    await load()
                }
            }
            .sheet(item: $pickingUp) { chore in
                PickupSheet(chore: chore) { await load() }
            }
            .sheet(isPresented: $showNewChore) {
                NewChoreSheet { await load() }
            }
        }
    }

    @ViewBuilder
    private func assignmentRow<Content: View>(
        _ assignment: AssignmentDTO,
        @ViewBuilder action: () -> Content
    ) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(title(for: assignment)).font(.body.weight(.medium))
                    if assignment.autoAssigned == true {
                        StatusBadge(text: "auto", color: .indigo)
                    }
                }
                HStack(spacing: 4) {
                    if let assignee = assignment.assigneeId {
                        Text(Environment_memberName(assignee))
                    }
                    if let due = assignment.dueDate {
                        Text("· due \(due.shortDateTime)")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text(money(assignment.baseAmountCents))
                .foregroundStyle(.green)
                .fontWeight(.semibold)
            action()
        }
    }

    private func Environment_memberName(_ id: String) -> String {
        app.memberName(id)
    }

    private func load() async {
        do {
            data = try await API.shared.get("/api/v1/chores")
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

/// Completion requires a photo of the finished work; extra pay is optional.
struct CompleteChoreSheet: View {
    let assignment: AssignmentDTO
    let choreTitle: String
    let onDone: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var proofData: Data?
    @State private var extraAmount = ""
    @State private var extraReason = ""
    @State private var errorMessage: String?
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Chore") {
                    LabeledContent(choreTitle) {
                        Text(money(assignment.baseAmountCents))
                            .foregroundStyle(.green)
                            .fontWeight(.semibold)
                    }
                }

                PhotoField(label: "📸 Photo proof (required)", imageData: $proofData)

                Section("Was it harder than usual? 💪") {
                    TextField("Extra amount ($, optional)", text: $extraAmount)
                        .decimalKeyboard()
                    TextField("Why? (required if requesting extra)", text: $extraReason, axis: .vertical)
                }

                Section {
                    ErrorText(message: errorMessage)
                    Button {
                        complete()
                    } label: {
                        if busy {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("✓ Mark Complete").frame(maxWidth: .infinity).fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || proofData == nil)
                }
            }
            .navigationTitle("Complete Chore")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func complete() {
        guard let proofData else { return }
        var fields: [String: String] = [:]
        if let cents = parseCents(extraAmount) {
            guard !extraReason.trimmed.isEmpty else {
                errorMessage = "Explain why the work deserves extra pay."
                return
            }
            fields["extraAmountCents"] = String(cents)
            fields["extraReason"] = extraReason.trimmed
        }
        busy = true
        Task {
            defer { busy = false }
            do {
                struct Response: Codable { let assignment: AssignmentDTO }
                let _: Response = try await API.shared.upload(
                    "/api/v1/assignments/\(assignment.id)/complete",
                    fields: fields,
                    fileField: "proof",
                    fileData: proofData)
                await onDone()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

/// Ask to skip or reschedule; a parent accepts (requirement 9-schedules).
struct SkipSheet: View {
    let assignment: AssignmentDTO
    let choreTitle: String
    let onDone: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reschedule = false
    @State private var newDue = Date().addingTimeInterval(72 * 3600)
    @State private var reason = ""
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("\"\(choreTitle)\"") {
                    Picker("Request", selection: $reschedule) {
                        Text("⏭️ Skip it").tag(false)
                        Text("📆 Move it").tag(true)
                    }
                    .pickerStyle(.segmented)
                    if reschedule {
                        DatePicker("New due date", selection: $newDue)
                    }
                    TextField("Why? (required)", text: $reason, axis: .vertical)
                }
                Section {
                    ErrorText(message: errorMessage)
                    Button("Submit Request") { submit() }
                        .disabled(reason.trimmed.isEmpty)
                } footer: {
                    Text("A parent must accept. A sole parent's own request applies immediately.")
                }
            }
            .navigationTitle("Skip / Reschedule")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() {
        perform($errorMessage) {
            let iso = ISO8601DateFormatter().string(from: newDue)
            let _: OutcomeResponse = try await API.shared.send(
                "POST", "/api/v1/assignments/\(assignment.id)/skip",
                json: [
                    "reason": reason.trimmed,
                    "newDueDate": reschedule ? iso : nil,
                ])
            await onDone()
            dismiss()
        }
    }
}

/// Pick up a pool chore for yourself (or others) with a due date + reminder.
struct PickupSheet: View {
    let chore: ChoreDTO
    let onDone: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var selected = Set<String>()
    @State private var dueDate = Date().addingTimeInterval(6 * 3600)
    @State private var reminderHour = 18
    @State private var remind = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Chore") {
                    LabeledContent(chore.title) {
                        Text(money(chore.amountCents))
                            .foregroundStyle(.green)
                            .fontWeight(.semibold)
                    }
                }
                Section("Who's doing it?") {
                    ForEach(app.family?.members ?? []) { member in
                        Button {
                            if selected.contains(member.id) {
                                selected.remove(member.id)
                            } else {
                                selected.insert(member.id)
                            }
                        } label: {
                            HStack {
                                AvatarView(emoji: member.emoji, isParent: member.isParent, size: 28)
                                Text(member.name).foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: selected.contains(member.id)
                                      ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected.contains(member.id)
                                                     ? AnyShapeStyle(.tint) : AnyShapeStyle(.tertiary))
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section("When") {
                    DatePicker("Due", selection: $dueDate)
                    Toggle("Daily reminder until done", isOn: $remind)
                    if remind {
                        Picker("Remind at", selection: $reminderHour) {
                            ForEach(0..<24, id: \.self) { hour in
                                Text("\(hour):00").tag(hour)
                            }
                        }
                    }
                }
                Section {
                    ErrorText(message: errorMessage)
                    Button("Assign Chore") { submit() }
                        .disabled(selected.isEmpty)
                }
            }
            .navigationTitle("Pick Up Chore")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { if let me = app.member?.id { selected = [me] } }
        }
    }

    private func submit() {
        perform($errorMessage) {
            struct Response: Codable { let assignments: [AssignmentDTO] }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/chores/\(chore.id)/pickup",
                json: [
                    "assigneeIds": Array(selected),
                    "dueDate": ISO8601DateFormatter().string(from: dueDate),
                    "reminderHour": remind ? reminderHour : -1,
                ])
            await onDone()
            dismiss()
        }
    }
}
