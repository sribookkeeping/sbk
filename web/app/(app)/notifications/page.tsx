import { requireMember } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { fmtDateTime } from "@/lib/format";
import { NotificationType } from "@/lib/types";
import { buttonSecondary, Card, EmptyState, PageHeader, Tile } from "@/components/ui";
import { IconBell, IconListChecks, IconZap } from "@/components/icons";

const TYPE_TILE: Record<string, { tone: string; icon: React.ReactNode }> = {
  [NotificationType.CLAIM_REMINDER]: { tone: "amber", icon: <IconZap className="h-5 w-5" /> },
  [NotificationType.AUTO_ASSIGNED]: {
    tone: "indigo",
    icon: <IconListChecks className="h-5 w-5" />,
  },
  [NotificationType.GENERAL]: { tone: "slate", icon: <IconBell className="h-5 w-5" /> },
};

export default async function NotificationsPage() {
  const member = await requireMember();
  const notifications = await listNotifications(member.id);
  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        action={
          hasUnread ? (
            <form action={markNotificationsRead}>
              <button type="submit" className={buttonSecondary}>
                Mark all read
              </button>
            </form>
          ) : undefined
        }
      />

      <Card className="mt-6">
        {notifications.length === 0 && (
          <EmptyState>
            Nothing yet. You&apos;ll hear about chores up for grabs and auto-assignments here.
          </EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {notifications.map((n) => {
            const tile = TYPE_TILE[n.type] ?? TYPE_TILE[NotificationType.GENERAL];
            return (
              <li key={n.id} className={`flex gap-3 py-3 ${n.readAt ? "opacity-60" : ""}`}>
                <Tile tone={tile.tone}>{tile.icon}</Tile>
                <div className="min-w-0">
                  <p className="font-medium">
                    {n.title}
                    {!n.readAt && (
                      <span className="ml-2 inline-block size-2 rounded-full bg-indigo-500 align-middle" />
                    )}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{n.body}</p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {fmtDateTime(n.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
