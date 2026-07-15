import Foundation
import UserNotifications

/// Local notifications driven by the server's data: after each dashboard sync
/// we reschedule a due-time alert plus a repeating daily reminder for every
/// open assignment (requirement 7). Server-side push (APNs) is the cloud
/// upgrade; these keep working meanwhile.
enum NotificationManager {
    private static let prefix = "sbk-chore-"

    static func requestAuthorization() {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
    }

    static func sync(openAssignments: [AssignmentDTO], memberName: String) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let stale = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: stale)

            for assignment in openAssignments where assignment.isPending {
                let title = assignment.choreTitle ?? "Chore"

                if assignment.reminderHour >= 0 {
                    let content = UNMutableNotificationContent()
                    content.title = "Chore reminder"
                    content.body = "\(memberName), \"\(title)\" is still waiting for you."
                    content.sound = .default
                    var components = DateComponents()
                    components.hour = assignment.reminderHour
                    components.minute = 0
                    center.add(UNNotificationRequest(
                        identifier: "\(prefix)daily-\(assignment.id)",
                        content: content,
                        trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: true)))
                }

                if let due = assignment.dueDate?.asDate, due > .now {
                    let content = UNMutableNotificationContent()
                    content.title = "Chore due"
                    content.body = "\(memberName), \"\(title)\" is due now."
                    content.sound = .default
                    let components = Calendar.current.dateComponents(
                        [.year, .month, .day, .hour, .minute], from: due)
                    center.add(UNNotificationRequest(
                        identifier: "\(prefix)due-\(assignment.id)",
                        content: content,
                        trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false)))
                }
            }
        }
    }

    static func cancelAll() {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let ours = pending.map(\.identifier).filter { $0.hasPrefix(prefix) }
            center.removePendingNotificationRequests(withIdentifiers: ours)
        }
    }
}
