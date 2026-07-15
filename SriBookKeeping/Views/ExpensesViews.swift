import SwiftUI

/// Expenses against the shared ledger: add with a required bill photo,
/// view receipts, edit or delete (owner or parent — all audited).
struct ExpensesView: View {
    @Environment(AppState.self) private var app
    @State private var expenses: [ExpenseDTO] = []
    @State private var showAdd = false
    @State private var selected: ExpenseDTO?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent(app.isAdult ? "Family total" : "My total") {
                        Text(money(expenses.reduce(0) { $0 + $1.amountCents }))
                            .fontWeight(.bold)
                            .foregroundStyle(.red)
                    }
                }
                Section {
                    if expenses.isEmpty {
                        Text("No expenses yet.").foregroundStyle(.secondary)
                    }
                    ForEach(expenses) { expense in
                        Button {
                            selected = expense
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(expense.title)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(.primary)
                                    Text("\(app.memberName(expense.memberId)) · \(expense.date.shortDate)")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text("-\(money(expense.amountCents))")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.red)
                            }
                        }
                    }
                }
                ErrorText(message: errorMessage)
            }
            .navigationTitle("Expenses")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAdd = true
                    } label: {
                        Label("Add", systemImage: "plus")
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
            .sheet(isPresented: $showAdd) {
                AddExpenseSheet { await load() }
            }
            .sheet(item: $selected) { expense in
                ExpenseDetailSheet(expense: expense) { await load() }
            }
        }
    }

    private func load() async {
        do {
            let response: ExpensesResponse = try await API.shared.get("/api/v1/expenses")
            expenses = response.expenses
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AddExpenseSheet: View {
    let onDone: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var amount = ""
    @State private var category = "OTHER"
    @State private var notes = ""
    @State private var payerId = ""
    @State private var receiptData: Data?
    @State private var errorMessage: String?
    @State private var busy = false

    private let categories = ["FOOD", "CLOTHING", "SCHOOL", "ENTERTAINMENT", "TOYS", "OTHER"]

    var body: some View {
        NavigationStack {
            Form {
                if app.isAdult {
                    Section("Who spent it?") {
                        Picker("Member", selection: $payerId) {
                            ForEach(app.family?.members ?? []) { member in
                                Text("\(member.emoji) \(member.name)").tag(member.id)
                            }
                        }
                    }
                }
                Section("Details") {
                    TextField("What was it?", text: $title)
                    TextField("Amount ($)", text: $amount)
                        .decimalKeyboard()
                    Picker("Category", selection: $category) {
                        ForEach(categories, id: \.self) { value in
                            Text(value.capitalized).tag(value)
                        }
                    }
                    TextField("Notes (optional)", text: $notes)
                }

                PhotoField(label: "🧾 Photo of the bill (required)", imageData: $receiptData)

                Section {
                    ErrorText(message: errorMessage)
                    Button {
                        save()
                    } label: {
                        if busy {
                            ProgressView().frame(maxWidth: .infinity)
                        } else {
                            Text("Save Expense").frame(maxWidth: .infinity).fontWeight(.semibold)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(busy || title.trimmed.isEmpty || parseCents(amount) == nil || receiptData == nil)
                }
            }
            .navigationTitle("New Expense")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task { payerId = app.member?.id ?? "" }
        }
    }

    private func save() {
        guard let receiptData, let cents = parseCents(amount) else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                struct Response: Codable { let expense: ExpenseDTO }
                let _: Response = try await API.shared.upload(
                    "/api/v1/expenses",
                    fields: [
                        "title": title.trimmed,
                        "amountCents": String(cents),
                        "category": category,
                        "notes": notes.trimmed,
                        "memberId": payerId,
                    ],
                    fileField: "receipt",
                    fileData: receiptData)
                await onDone()
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

struct ExpenseDetailSheet: View {
    let expense: ExpenseDTO
    let onDone: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var editedTitle = ""
    @State private var editedAmount = ""
    @State private var editing = false
    @State private var errorMessage: String?

    private var canTouch: Bool {
        expense.memberId == app.member?.id || app.isParent
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    if editing {
                        TextField("Title", text: $editedTitle)
                        TextField("Amount ($)", text: $editedAmount)
                            .decimalKeyboard()
                    } else {
                        LabeledContent("Title", value: expense.title)
                        LabeledContent("Amount", value: money(expense.amountCents))
                    }
                    LabeledContent("Spent by", value: app.memberName(expense.memberId))
                    LabeledContent("Category", value: expense.category.capitalized)
                    LabeledContent("Date", value: expense.date.shortDate)
                    if !expense.notes.isEmpty {
                        LabeledContent("Notes", value: expense.notes)
                    }
                }

                Section("🧾 Bill / receipt") {
                    AuthorizedImage(path: expense.receiptUrl)
                        .frame(maxHeight: 260)
                }

                if canTouch {
                    Section {
                        ErrorText(message: errorMessage)
                        if editing {
                            Button("Save changes") { saveEdits() }
                                .disabled(editedTitle.trimmed.isEmpty || parseCents(editedAmount) == nil)
                        } else {
                            Button("✏️ Edit") {
                                editedTitle = expense.title
                                editedAmount = String(format: "%.2f", Double(expense.amountCents) / 100)
                                editing = true
                            }
                        }
                        Button("🗑 Delete expense", role: .destructive) { deleteExpense() }
                    } footer: {
                        Text("Edits and deletions are recorded in the audit log for parent review.")
                    }
                }
            }
            .navigationTitle("Expense")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private func saveEdits() {
        guard let cents = parseCents(editedAmount) else { return }
        perform($errorMessage) {
            let _: [String: Bool] = try await API.shared.send(
                "PATCH", "/api/v1/expenses/\(expense.id)",
                json: ["title": editedTitle.trimmed, "amountCents": cents])
            await onDone()
            dismiss()
        }
    }

    private func deleteExpense() {
        perform($errorMessage) {
            let _: [String: Bool] = try await API.shared.send(
                "DELETE", "/api/v1/expenses/\(expense.id)")
            await onDone()
            dismiss()
        }
    }
}
