import SwiftUI

/// Family brainstorming events with one group chat each. Surprise exclusions
/// are enforced server-side — excluded members simply never receive them.
struct EventsView: View {
    @Environment(AppState.self) private var app
    @State private var events: [EventDTO] = []
    @State private var showNew = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            if events.isEmpty {
                Text("No events yet — start planning something fun!")
                    .foregroundStyle(.secondary)
            }
            ForEach(events) { event in
                NavigationLink(value: event) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text("🎉 \(event.title)").font(.body.weight(.medium))
                            if event.revealedAt != nil {
                                StatusBadge(text: "🎊 Revealed", color: .green)
                            } else if !event.excludedMemberIds.isEmpty {
                                StatusBadge(text: "🤫 Surprise", color: .indigo)
                            }
                        }
                        Text("\(event.messageCount) messages · \(event.choreCount) chores · by \(event.createdBy?.name ?? "someone")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            ErrorText(message: errorMessage)
        }
        .navigationTitle("Events")
        .navigationDestination(for: EventDTO.self) { event in
            EventDetailView(event: event)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showNew = true
                } label: {
                    Label("New", systemImage: "plus")
                }
            }
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showNew) {
            NewEventSheet { await load() }
        }
    }

    private func load() async {
        do {
            let response: EventsResponse = try await API.shared.get("/api/v1/events")
            events = response.events
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct NewEventSheet: View {
    let onDone: () async -> Void

    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var details = ""
    @State private var excluded = Set<String>()
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("What are we planning?") {
                    TextField("Mom's surprise birthday party", text: $title)
                    TextField("Details (optional)", text: $details, axis: .vertical)
                }
                Section("🤫 Keep it secret from…") {
                    ForEach((app.family?.members ?? []).filter { $0.id != app.member?.id }) { member in
                        Button {
                            if excluded.contains(member.id) {
                                excluded.remove(member.id)
                            } else {
                                excluded.insert(member.id)
                            }
                        } label: {
                            HStack {
                                AvatarView(emoji: member.emoji, isParent: member.isParent, size: 28)
                                Text(member.name).foregroundStyle(.primary)
                                Spacer()
                                if excluded.contains(member.id) {
                                    Image(systemName: "eye.slash.fill").foregroundStyle(.indigo)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section {
                    ErrorText(message: errorMessage)
                    Button("Start Planning") { save() }
                        .disabled(title.trimmed.isEmpty)
                } footer: {
                    Text("Excluded members never see the event, its chat, or its chores — until you reveal it.")
                }
            }
            .navigationTitle("New Event")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func save() {
        perform($errorMessage) {
            struct Response: Codable {
                struct E: Codable { let id: String; let title: String }
                let event: E
            }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/events",
                json: [
                    "title": title.trimmed,
                    "details": details.trimmed,
                    "excludedMemberIds": Array(excluded),
                ])
            await onDone()
            dismiss()
        }
    }
}

struct EventDetailView: View {
    let event: EventDTO

    @Environment(AppState.self) private var app
    @State private var messages: [MessageDTO] = []
    @State private var draft = ""
    @State private var revealed = false
    @State private var errorMessage: String?

    private var canReveal: Bool {
        !event.excludedMemberIds.isEmpty && !revealed && event.revealedAt == nil &&
        (event.createdBy?.id == app.member?.id || app.isParent)
    }

    var body: some View {
        List {
            if !event.details.isEmpty {
                Section { Text(event.details) }
            }
            if canReveal {
                Section {
                    Button("🎊 Reveal the surprise — visible to everyone") {
                        perform($errorMessage) {
                            let _: [String: Bool] = try await API.shared.send(
                                "POST", "/api/v1/events/\(event.id)/reveal")
                            revealed = true
                        }
                    }
                    .foregroundStyle(.indigo)
                }
            }
            Section("Group chat") {
                if messages.isEmpty {
                    Text("No messages yet — kick off the brainstorm! 💡")
                        .foregroundStyle(.secondary)
                }
                ForEach(messages) { message in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(message.author?.emoji ?? "") \(message.author?.name ?? "Someone") · \(message.createdAt.shortDateTime)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(message.body)
                    }
                }
                HStack {
                    TextField("Share an idea…", text: $draft)
                    Button("Send") { send() }
                        .disabled(draft.trimmed.isEmpty)
                }
            }
            ErrorText(message: errorMessage)
        }
        .navigationTitle("🎉 \(event.title)")
        .refreshable { await load() }
        .task { await load() }
    }

    private func send() {
        perform($errorMessage) {
            struct Response: Codable {
                struct M: Codable { let id: String; let createdAt: String }
                let message: M
            }
            let _: Response = try await API.shared.send(
                "POST", "/api/v1/events/\(event.id)/messages",
                json: ["body": draft.trimmed])
            draft = ""
            await load()
        }
    }

    private func load() async {
        do {
            let response: MessagesResponse = try await API.shared.get("/api/v1/events/\(event.id)/messages")
            messages = response.messages
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
