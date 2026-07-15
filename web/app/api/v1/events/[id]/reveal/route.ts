import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { eventForMember } from "@/lib/events";
import { notifyFamily } from "@/lib/notifications";
import { NotificationType } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** POST — reveal a surprise event (creator or any parent). */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, _request, { params }) => {
    const { id } = await params;
    const event = await eventForMember(id, member);
    if (!event) return apiError("Event not found", 404);
    if (event.revealedAt) return apiError("Already revealed", 409);
    if (event.createdById !== member.id && member.role !== "PARENT") {
      return apiError("Only the creator or a parent can reveal", 403);
    }

    await db.event.update({ where: { id }, data: { revealedAt: new Date() } });
    await audit(member, AuditAction.EVENT_REVEALED, "Event", id, { title: event.title });
    await notifyFamily(
      member.familyId,
      NotificationType.EVENT,
      "Surprise revealed! 🎊",
      `The planning for "${event.title}" is now visible to everyone.`,
    );
    return json({ ok: true });
  },
);
