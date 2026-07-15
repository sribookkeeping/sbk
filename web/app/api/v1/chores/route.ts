import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { submitPoolChore } from "@/lib/approvals";
import { choreHiddenFrom, eventForMember } from "@/lib/events";
import { notifyFamily } from "@/lib/notifications";
import { ChoreKind, NotificationType } from "@/lib/types";
import { apiError, json, serializeAssignment, serializeChore, withAuth } from "@/lib/api";

/** GET → all family chores + pending assignments. */
export const GET = withAuth(async (member) => {
  const [chores, assignments] = await Promise.all([
    db.chore.findMany({
      where: { familyId: member.familyId, deletedAt: null },
      include: { event: true },
      orderBy: { createdAt: "desc" },
    }),
    db.assignment.findMany({
      where: { chore: { familyId: member.familyId }, status: "PENDING" },
      include: { chore: { include: { event: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  // Surprise-event chores are invisible to excluded members.
  return json({
    chores: chores.filter((c) => !choreHiddenFrom(c, member.id)).map(serializeChore),
    pendingAssignments: assignments
      .filter((a) => !choreHiddenFrom(a.chore, member.id))
      .map(serializeAssignment),
  });
});

/**
 * POST { title, details?, amountCents, addToPool?, assigneeIds?, dueDate?,
 *        reminderHour?, openToAnyone? }
 * Mirrors the web "New Chore" form, approval rules included. `openToAnyone`
 * is mutually exclusive with `assigneeIds`: it creates one unclaimed
 * assignment anyone can claim (auto-assigned near the due date if unclaimed).
 */
export const POST = withAuth(async (member, request) => {
  let body: {
    title?: string;
    details?: string;
    amountCents?: number;
    addToPool?: boolean;
    assigneeIds?: string[];
    dueDate?: string;
    reminderHour?: number;
    openToAnyone?: boolean;
    eventId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const title = (body.title ?? "").trim();
  const amountCents = Math.round(body.amountCents ?? 0);
  const event = body.eventId ? await eventForMember(body.eventId, member) : null;
  if (body.eventId && !event) return apiError("Event not found", 404);
  // Event chores never join the pool (they'd leak the surprise).
  const addToPool = body.addToPool === true && !event;
  const openToAnyone = body.openToAnyone === true;
  const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
  const validAssignees = member.family.members.filter((m) => assigneeIds.includes(m.id));

  if (!title) return apiError("title is required", 400);
  if (amountCents <= 0) return apiError("amountCents must be positive", 400);
  if (!addToPool && !openToAnyone && validAssignees.length === 0) {
    return apiError("Provide assigneeIds, openToAnyone, or addToPool", 400);
  }

  const chore = await db.chore.create({
    data: {
      familyId: member.familyId,
      title,
      details: (body.details ?? "").trim(),
      amountCents,
      kind: addToPool ? ChoreKind.POOL : ChoreKind.ONE_TIME,
      createdById: member.id,
      eventId: event?.id ?? null,
    },
  });

  if (addToPool) await submitPoolChore(chore.id, member);

  if (openToAnyone) {
    await db.assignment.create({
      data: {
        choreId: chore.id,
        assigneeId: null,
        assignedById: member.id,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        reminderHour: body.reminderHour ?? -1,
        baseAmountCents: amountCents,
      },
    });
    if (!body.dueDate) {
      await notifyFamily(
        member.familyId,
        NotificationType.CLAIM_REMINDER,
        "New chore up for grabs! 🙋",
        `${member.name} posted "${title}". First to claim it earns it!`,
      );
    }
  } else {
    for (const assignee of validAssignees) {
      await db.assignment.create({
        data: {
          choreId: chore.id,
          assigneeId: assignee.id,
          assignedById: member.id,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          reminderHour: body.reminderHour ?? -1,
          baseAmountCents: amountCents,
        },
      });
    }
  }

  await audit(member, AuditAction.CHORE_CREATED, "Chore", chore.id, {
    title,
    amountCents,
    openToAnyone,
    addToPool,
  });
  const created = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
  return json({ chore: serializeChore(created) }, 201);
});
