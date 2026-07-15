import Foundation

// Codable models mirroring the web API (web/API.md).
// Money is integer cents; dates are ISO-8601 strings (parse via `.asDate`).

struct MemberDTO: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let role: String
    let isHead: Bool
    let emoji: String
    let email: String?
    var isPlatformAdmin: Bool? = false
    var reportFrequency: String? = "MONTHLY"

    var isParent: Bool { role == "PARENT" }
    var isAdult: Bool { role != "CHILD" }
    var roleLabel: String { role.capitalized }
}

struct FamilyDTO: Codable, Hashable {
    let id: String
    let name: String
    let members: [MemberDTO]

    var parents: [MemberDTO] { members.filter(\.isParent) }
}

struct LoginResponse: Codable {
    let token: String
    let member: MemberDTO
    let family: FamilyDTO
}

struct MeResponse: Codable {
    let member: MemberDTO
    let family: FamilyDTO
}

struct ChoreDTO: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let details: String
    let amountCents: Int
    let kind: String        // POOL | ONE_TIME
    let poolStatus: String  // PENDING_APPROVAL | ACTIVE | REJECTED | RETIRED
    let createdById: String?
    let createdAt: String

    var isAvailableInPool: Bool { kind == "POOL" && poolStatus == "ACTIVE" }
}

struct AssignmentDTO: Codable, Identifiable, Hashable {
    let id: String
    let choreId: String
    let assigneeId: String?
    let assignedById: String?
    let dueDate: String?
    let reminderHour: Int
    let status: String      // PENDING | COMPLETED | CANCELLED
    let completedAt: String?
    let baseAmountCents: Int
    let extraAmountCents: Int
    let extraReason: String
    let extraStatus: String // NONE | PENDING | APPROVED | DENIED
    var autoAssigned: Bool? = false
    var proofUrl: String? = nil
    var choreTitle: String? = nil // present on /dashboard

    var isPending: Bool { status == "PENDING" }
    var isUnclaimed: Bool { assigneeId == nil && isPending }
}

struct ChoresResponse: Codable {
    let chores: [ChoreDTO]
    let pendingAssignments: [AssignmentDTO]
}

struct MemberBalanceDTO: Codable, Hashable {
    let earnedCents: Int
    let spentCents: Int
    let paidOutCents: Int
    let balanceCents: Int
    let pendingExtraCents: Int
}

struct DashboardResponse: Codable {
    let balances: [String: MemberBalanceDTO]
    let openAssignments: [AssignmentDTO]
}

struct ApprovalDTO: Codable, Identifiable, Hashable {
    struct Requester: Codable, Hashable {
        let id: String
        let name: String
    }
    let id: String
    let type: String
    let status: String // PENDING | APPROVED | REJECTED
    let headline: String
    let note: String
    let amountCents: Int?
    let requestedBy: Requester?
    let requiresBothParents: Bool
    let canDecide: Bool
    let createdAt: String
    let decidedAt: String?
}

struct ApprovalsResponse: Codable {
    let requests: [ApprovalDTO]
}

struct ScheduleDTO: Codable, Identifiable, Hashable {
    struct Assignee: Codable, Hashable {
        let id: String
        let name: String
    }
    let id: String
    let choreId: String
    let choreTitle: String
    let recurrence: String
    let description: String
    let weekdays: String
    let dayOfMonth: Int
    let reminderHour: Int
    let status: String
    let assignees: [Assignee]
    let createdAt: String
}

struct SchedulesResponse: Codable {
    let schedules: [ScheduleDTO]
}

struct ExpenseDTO: Codable, Identifiable, Hashable {
    let id: String
    let memberId: String
    let title: String
    let amountCents: Int
    let date: String
    let category: String
    let notes: String
    let receiptUrl: String
}

struct ExpensesResponse: Codable {
    let expenses: [ExpenseDTO]
}

struct PayoutDTO: Codable, Identifiable, Hashable {
    let id: String
    let memberId: String
    let memberName: String
    let paidByName: String?
    let amountCents: Int
    let note: String
    let createdAt: String
}

struct PayoutsResponse: Codable {
    let payouts: [PayoutDTO]
}

struct NotificationDTO: Codable, Identifiable, Hashable {
    let id: String
    let type: String
    let title: String
    let body: String
    let assignmentId: String?
    let readAt: String?
    let createdAt: String
}

struct NotificationsResponse: Codable {
    let unread: Int
    let notifications: [NotificationDTO]
}

struct EventDTO: Codable, Identifiable, Hashable {
    struct Creator: Codable, Hashable {
        let id: String
        let name: String
    }
    let id: String
    let title: String
    let details: String
    let eventDate: String?
    let excludedMemberIds: [String]
    var revealedAt: String? = nil
    let createdBy: Creator?
    let messageCount: Int
    let choreCount: Int
    let createdAt: String
}

struct EventsResponse: Codable {
    let events: [EventDTO]
}

struct MessageDTO: Codable, Identifiable, Hashable {
    struct Author: Codable, Hashable {
        let id: String
        let name: String
        let emoji: String
    }
    let id: String
    let author: Author?
    let body: String
    let createdAt: String
}

struct MessagesResponse: Codable {
    struct EventRef: Codable {
        let id: String
        let title: String
    }
    let event: EventRef
    let messages: [MessageDTO]
}

struct ReportSummaryDTO: Codable, Identifiable, Hashable {
    let memberId: String
    let name: String
    let emoji: String
    let role: String
    let choresCompleted: Int
    let earnedCents: Int
    let expenseCount: Int
    let spentCents: Int
    let paidOutCents: Int
    let netCents: Int
    let allTimeBalanceCents: Int

    var id: String { memberId }
}

struct ReportResponse: Codable {
    struct Totals: Codable {
        let earnedCents: Int
        let spentCents: Int
        let netCents: Int
    }
    let periodStart: String
    let periodEnd: String
    let members: [ReportSummaryDTO]
    let totals: Totals
    let reportFrequency: String
}

struct AuditEntryDTO: Codable, Identifiable, Hashable {
    let id: String
    let action: String
    let actorName: String
    let viaAdmin: Bool
    let entityType: String
    let entityId: String?
    let details: String
    let createdAt: String
}

struct AuditResponse: Codable {
    let entries: [AuditEntryDTO]
}

struct OutcomeResponse: Codable {
    let outcome: String // "applied" | "pending"
}

// MARK: - Formatting helpers

extension String {
    /// Parses an ISO-8601 timestamp from the API.
    var asDate: Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: self) { return date }
        return ISO8601DateFormatter().date(from: self)
    }

    var shortDateTime: String {
        guard let date = asDate else { return self }
        return date.formatted(date: .abbreviated, time: .shortened)
    }

    var shortDate: String {
        guard let date = asDate else { return self }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}

func money(_ cents: Int) -> String {
    let amount = Decimal(cents) / 100
    return amount.formatted(.currency(code: "USD"))
}
