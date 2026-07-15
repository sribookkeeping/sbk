import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { ChoreKind, PoolStatus } from "@/lib/types";
import { apiError, json, serializeAssignment, withAuth } from "@/lib/api";

/** POST { assigneeIds?, dueDate?, reminderHour? } — defaults to picking up for yourself. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;
    const chore = await db.chore.findUnique({ where: { id } });
    if (!chore || chore.familyId !== member.familyId) return apiError("Chore not found", 404);
    if (chore.kind !== ChoreKind.POOL || chore.poolStatus !== PoolStatus.ACTIVE) {
      return apiError("Chore is not available", 409);
    }

    let body: { assigneeIds?: string[]; dueDate?: string; reminderHour?: number } = {};
    try {
      body = await request.json();
    } catch {
      // empty body = pick up for yourself
    }

    const assigneeIds =
      Array.isArray(body.assigneeIds) && body.assigneeIds.length > 0
        ? body.assigneeIds
        : [member.id];
    const validAssignees = member.family.members.filter((m) => assigneeIds.includes(m.id));
    if (validAssignees.length === 0) return apiError("No valid assignees", 400);

    const created = await Promise.all(
      validAssignees.map((assignee) =>
        db.assignment.create({
          data: {
            choreId: chore.id,
            assigneeId: assignee.id,
            assignedById: member.id,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            reminderHour: body.reminderHour ?? -1,
            baseAmountCents: chore.amountCents,
          },
        }),
      ),
    );

    await audit(member, AuditAction.ASSIGNMENT_CREATED, "Chore", chore.id, {
      title: chore.title,
      assignees: validAssignees.map((m) => m.name),
    });
    return json({ assignments: created.map(serializeAssignment) }, 201);
  },
);
