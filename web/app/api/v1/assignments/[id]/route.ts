import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { AssignmentStatus } from "@/lib/types";
import { apiError, json, serializeAssignment, withAuth } from "@/lib/api";

/** PATCH { dueDate?, reminderHour? } — edit an assignment (assignee or parent). */
export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
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
      return apiError("Only the assignee or a parent can edit this", 403);
    }

    let body: { dueDate?: string | null; reminderHour?: number };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const updated = await db.assignment.update({
      where: { id },
      data: {
        ...(body.dueDate !== undefined
          ? { dueDate: body.dueDate ? new Date(body.dueDate) : null }
          : {}),
        ...(typeof body.reminderHour === "number" ? { reminderHour: body.reminderHour } : {}),
        claimRemindedAt: null,
      },
    });
    await audit(member, AuditAction.ASSIGNMENT_EDITED, "Assignment", id, {
      chore: assignment.chore.title,
    });
    return json({ assignment: serializeAssignment(updated) });
  },
);
