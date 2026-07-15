import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { tryClaim } from "@/lib/assignments";
import { isExcludedFrom } from "@/lib/events";
import { apiError, json, serializeAssignment, withAuth } from "@/lib/api";

/**
 * POST → claim an unclaimed scheduled chore for yourself, or take over an
 * auto-assigned one from another member.
 */
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
    // Members excluded from the chore's event can't claim it (surprise!).
    if (assignment.chore.event && isExcludedFrom(assignment.chore.event, member.id)) {
      return apiError("Assignment not found", 404);
    }

    // Atomic: when two members claim simultaneously, exactly one wins.
    if (!(await tryClaim(id, member.id))) {
      return apiError("Not claimable — already taken or completed", 409);
    }

    await audit(member, AuditAction.ASSIGNMENT_CLAIMED, "Assignment", id, {
      chore: assignment.chore.title,
    });
    const updated = await db.assignment.findUniqueOrThrow({ where: { id } });
    return json({ assignment: serializeAssignment(updated) });
  },
);
