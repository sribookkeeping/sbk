import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { submitSchedule } from "@/lib/approvals";
import { recurrenceDescription } from "@/lib/schedules";
import { ChoreKind, PoolStatus, Recurrence } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** GET → all schedules in the family. */
export const GET = withAuth(async (member) => {
  const schedules = await db.schedule.findMany({
    where: { familyId: member.familyId },
    include: { chore: true, assignees: { include: { member: true } } },
    orderBy: { createdAt: "desc" },
  });
  return json({
    schedules: schedules.map((s) => ({
      id: s.id,
      choreId: s.choreId,
      choreTitle: s.chore.title,
      recurrence: s.recurrence,
      description: recurrenceDescription(s),
      weekdays: s.weekdays,
      dayOfMonth: s.dayOfMonth,
      reminderHour: s.reminderHour,
      status: s.status,
      assignees: s.assignees.map((a) => ({ id: a.member.id, name: a.member.name })),
      createdAt: s.createdAt.toISOString(),
    })),
  });
});

/**
 * POST { choreId, recurrence, weekdays?, dayOfMonth?, reminderHour?,
 *        assigneeIds?, openToAnyone? }
 * openToAnyone: true → no fixed assignees; each occurrence is claimable and
 * auto-assigned if unclaimed (see README).
 */
export const POST = withAuth(async (member, request) => {
  let body: {
    choreId?: string;
    recurrence?: string;
    weekdays?: number[];
    dayOfMonth?: number;
    reminderHour?: number;
    assigneeIds?: string[];
    openToAnyone?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const chore = await db.chore.findUnique({ where: { id: body.choreId ?? "" } });
  if (
    !chore ||
    chore.familyId !== member.familyId ||
    chore.kind !== ChoreKind.POOL ||
    chore.poolStatus !== PoolStatus.ACTIVE
  ) {
    return apiError("choreId must be an active pool chore", 400);
  }

  const recurrence = body.recurrence ?? Recurrence.WEEKLY;
  if (!Object.values(Recurrence).includes(recurrence as Recurrence)) {
    return apiError("Invalid recurrence", 400);
  }
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays.filter((d) => d >= 1 && d <= 7) : [];
  if (recurrence === Recurrence.WEEKLY && weekdays.length === 0) {
    return apiError("weekdays required for weekly recurrence", 400);
  }

  const openToAnyone = body.openToAnyone === true;
  const assigneeIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : [];
  const validAssignees = member.family.members.filter(
    (m) => assigneeIds.includes(m.id) && !m.deactivatedAt,
  );
  if (!openToAnyone && validAssignees.length === 0) {
    return apiError("assigneeIds required (or set openToAnyone: true)", 400);
  }

  const schedule = await db.schedule.create({
    data: {
      familyId: member.familyId,
      choreId: chore.id,
      recurrence,
      weekdays: weekdays.join(","),
      dayOfMonth: Math.min(Math.max(body.dayOfMonth ?? 1, 1), 31),
      reminderHour: body.reminderHour ?? 18,
      createdById: member.id,
      assignees: openToAnyone
        ? undefined
        : { create: validAssignees.map((m) => ({ memberId: m.id })) },
    },
  });
  await submitSchedule(schedule.id, member);

  await audit(member, AuditAction.SCHEDULE_CREATED, "Schedule", schedule.id, {
    chore: chore.title,
    recurrence,
  });
  const created = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
  return json({ schedule: { id: created.id, status: created.status } }, 201);
});
