import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { fmtMoney } from "@/lib/format";
import { notifyFamily } from "@/lib/notifications";
import { AssignmentStatus, NotificationType } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** POST — give up a held assignment; it returns to "up for grabs". */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, _request, { params }) => {
    const { id } = await params;
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: { chore: { include: { event: true } } },
    });
    if (!assignment || assignment.chore.familyId !== member.familyId) {
      return apiError("Assignment not found", 404);
    }
    if (assignment.status !== AssignmentStatus.PENDING) return apiError("Already completed", 409);
    if (assignment.assigneeId !== member.id && member.role !== "PARENT") {
      return apiError("Only the assignee or a parent can give this up", 403);
    }
    if (!assignment.assigneeId) return apiError("Already unclaimed", 409);

    await db.assignment.update({
      where: { id },
      data: { assigneeId: null, autoAssigned: false, claimRemindedAt: null },
    });
    await audit(member, AuditAction.ASSIGNMENT_GIVEN_UP, "Assignment", id, {
      chore: assignment.chore.title,
    });
    await notifyFamily(
      member.familyId,
      NotificationType.CLAIM_REMINDER,
      "Chore back up for grabs 🙋",
      `${member.name} gave up "${assignment.chore.title}" (${fmtMoney(assignment.baseAmountCents)}). First to claim it earns it!`,
      id,
      assignment.chore.event ? assignment.chore.event.excludedIds.split(",").filter(Boolean) : [],
    );
    return json({ ok: true });
  },
);
