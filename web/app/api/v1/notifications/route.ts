import { listNotifications, markAllRead, unreadCount } from "@/lib/notifications";
import { json, withAuth } from "@/lib/api";

/** GET → my notifications, newest first, plus unread count. */
export const GET = withAuth(async (member) => {
  const [notifications, unread] = await Promise.all([
    listNotifications(member.id),
    unreadCount(member.id),
  ]);
  return json({
    unread,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      assignmentId: n.assignmentId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
});

/** POST → mark all of my notifications read. */
export const POST = withAuth(async (member) => {
  await markAllRead(member.id);
  return json({ ok: true });
});
