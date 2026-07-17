import { requireMember } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { fmtDateTime } from "@/lib/format";
import { NotificationType } from "@/lib/types";
import { buttonSecondary, Card, EmptyState } from "@/components/ui";

const TYPE_EMOJI: Record<string, string> = {
  [NotificationType.CLAIM_REMINDER]: "🙋",
  [NotificationType.AUTO_ASSIGNED]: "🎯",
  [NotificationType.GENERAL]: "📣",
};

export default async function NotificationsPage() {
  const member = await requireMember();
  const notifications = await listNotifications(member.id);
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {hasUnread && (
          <form action={markNotificationsRead}>
            <button type="submit" className={buttonSecondary}>
              Mark all read
            </button>
          </form>
        )}
      </div>

      <Card className="mt-6">
        {notifications.length === 0 && (
          <EmptyState>
            Nothing yet. You&apos;ll hear about chores up for grabs and auto-assignments here.
          </EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {notifications.map((n) => (
            <li key={n.id} className={`flex gap-3 py-3 ${n.readAt ? "opacity-60" : ""}`}>
              <span className="text-xl">{TYPE_EMOJI[n.type] ?? "📣"}</span>
              <div>
                <p className="font-medium">
                  {n.title}
                  {!n.readAt && (
                    <span className="ml-2 inline-block size-2 rounded-full bg-red-500 align-middle" />
                  )}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
