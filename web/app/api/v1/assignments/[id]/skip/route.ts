import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { submitSkipRequest } from "@/lib/approvals";
import { AssignmentStatus } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/**
 * POST { reason, newDueDate? } — ask to skip (no newDueDate) or reschedule
 * an assignment. Any one parent accepts; a sole parent's own request applies
 * immediately. Returns { outcome: "applied" | "pending" }.
 */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: { chore: true },
    });
    if (!assignment || assignment.chore.familyId !== member.familyId) {
      return apiError("Assignment not found", 404);
    }
    if (assignment.status !== AssignmentStatus.PENDING) return apiError("Already completed", 409);
    if (assignment.assigneeId !== member.id && member.role !== "PARENT") {
      return apiError("Only the assignee or a parent can ask to skip this", 403);
    }

    let body: { reason?: string; newDueDate?: string };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }
    const reason = (body.reason ?? "").trim();
    if (!reason) return apiError("reason is required", 400);

    const payload = body.newDueDate
      ? { newDueDate: new Date(body.newDueDate).toISOString() }
      : { skip: true };
    const outcome = await submitSkipRequest(id, payload, reason, member);

    await audit(member, AuditAction.SKIP_REQUESTED, "Assignment", id, {
      chore: assignment.chore.title,
      reason,
      outcome,
    });
    return json({ outcome });
  },
);
