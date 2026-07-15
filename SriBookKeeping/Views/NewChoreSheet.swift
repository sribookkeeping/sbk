import SwiftUI

/// Create a chore from the phone — same rules as the website: assign to
/// members OR open it for anyone to claim; optionally add it to the family
/// pool (parent approval rules apply server-side).
struct NewChoreSheet: View {
    let onDone: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var details = ""
    @State private var amount = ""
    @State private var openToAnyone = false
    @State private var addToPool = false
    @State private var selected = Set<String>()
    @State private var hasDue = true
    @State private var dueDate = Date().addingTimeInterval(24 * 3600)
    @State private var reminderHour = 18
    @State private var remind = true
    @State private var errorMessage: String?

    private var canSave: Bool {
        guard !title.trimmed.isEmpty, parseCents(amount) != nil else { return false }
        return openToAnyone || addToPool || !selected.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Chore") {
                    TextField("Title (e.g. Mow the lawn)", text: $title)
                    TextField("Details (optional)", text: $details, axis: .vertical)
                    TextField("Amount ($)", text: $amount)
                        .decimalKeyboard()
                }

                Section("Who does it?") {
                    Toggle("🙋 Open for anyone to claim", isOn: $openToAnyone)
                    if !openToAnyone {
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
                }

                Section {
                    Toggle("Add to family chore pool", isOn: $addToPool)
                } footer: {
                    Text("Pool chores follow the approval rules: a kid's chore needs a parent; a parent's chore needs the other parent.")
                }

                Section("When") {
                    Toggle("Has a due date", isOn: $hasDue)
                    if hasDue {
                        DatePicker("Due", selection: $dueDate)
                    }
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
                    Button("Save Chore") { save() }
                        .disabled(!canSave)
                } footer: {
                    Text("Recurring schedules are set up on the website for now.")
                }
            }
            .navigationTitle("New Chore")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func save() {
        guard let cents = parseCents(amount) else { return }
        perform($errorMessage) {
            struct Response: Codable { let chore: ChoreDTO }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/chores",
                json: [
                    "title": title.trimmed,
                    "details": details.trimmed,
                    "amountCents": cents,
                    "addToPool": addToPool,
                    "openToAnyone": openToAnyone,
                    "assigneeIds": openToAnyone ? [] : Array(selected),
                    "dueDate": hasDue ? ISO8601DateFormatter().string(from: dueDate) : nil,
                    "reminderHour": remind ? reminderHour : -1,
                ])
            await onDone()
            dismiss()
        }
    }
}
