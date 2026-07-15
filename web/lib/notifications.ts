import { db } from "@/lib/db";
import { NotificationType } from "@/lib/types";

// In-app notifications (bell in the header). Locally these are created by the
// schedule sweep on page loads; in the cloud, a cron makes the timing exact and
// the same rows can fan out to email / web push / APNs (see README).

export async function notifyFamily(
  familyId: string,
  type: string,
  title: string,
  body: string,
  assignmentId?: string,
  excludeIds: string[] = [], // e.g. members kept out of a surprise event
): Promise<void> {
  const members = await db.member.findMany({ where: { familyId }, select: { id: true } });
  const recipients = members.filter((m) => !excludeIds.includes(m.id));
  if (recipients.length === 0) return;
  await db.notification.createMany({
    data: recipients.map((m) => ({
      familyId,
      memberId: m.id,
      type,
      title,
      body,
      assignmentId: assignmentId ?? null,
    })),
  });
}

export async function unreadCount(memberId: string): Promise<number> {
  return db.notification.count({ where: { memberId, readAt: null } });
}

export async function listNotifications(memberId: string, take = 50) {
  return db.notification.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markAllRead(memberId: string): Promise<void> {
  await db.notification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: new Date() },
  });
}

export { NotificationType };
