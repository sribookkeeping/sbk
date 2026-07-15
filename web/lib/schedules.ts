import { db } from "@/lib/db";
import { parseIds } from "@/lib/approvals";
import {
  addDaysInZone,
  fmtDateTime,
  fmtMoney,
  serverZone,
  startOfDayInZone,
  zonedParts,
  zonedTimeToUtc,
} from "@/lib/format";
import { notifyFamily } from "@/lib/notifications";
import { AssignmentStatus, NotificationType, Recurrence, ScheduleStatus } from "@/lib/types";

// Turns approved schedules into concrete assignments and runs the claim flow
// for OPEN schedules (no fixed assignees):
//
//   1. Occurrences are materialized up to 2 days ahead. Open occurrences have
//      no assignee — anyone in the family can claim them.
//   2. ~24h before the due date, every family member is notified to claim it.
//   3. If still unclaimed 12h after the reminder (or within 12h of the due
//      date), it is auto-assigned to the member with the fewest open chores,
//      and the whole family is notified. Others can still take it over.
//
// Runs opportunistically on page loads (idempotent). In the cloud, also wire
// it to an hourly cron so the timing is exact — see README.

const MATERIALIZE_AHEAD_DAYS = 2;
const CLAIM_REMINDER_MS = 24 * 60 * 60 * 1000;
const AUTO_ASSIGN_AFTER_MS = 12 * 60 * 60 * 1000;

type ScheduleLite = {
  recurrence: string;
  weekdays: string;
  dayOfMonth: number;
};

export function occursOn(
  schedule: ScheduleLite,
  date: Date,
  timeZone: string = serverZone(),
): boolean {
  switch (schedule.recurrence) {
    case Recurrence.DAILY:
      return true;
    case Recurrence.WEEKLY: {
      const weekday = zonedParts(date, timeZone).weekday; // 1 = Sunday … 7 = Saturday
      return parseIds(schedule.weekdays).map(Number).includes(weekday);
    }
    case Recurrence.MONTHLY: {
      const parts = zonedParts(date, timeZone);
      if (parts.day === schedule.dayOfMonth) return true;
      // e.g. "day 31" fires on the last day of shorter months
      const lastDay = new Date(parts.year, parts.month, 0).getDate();
      return schedule.dayOfMonth > lastDay && parts.day === lastDay;
    }
    default:
      return false;
  }
}

export function recurrenceDescription(schedule: ScheduleLite): string {
  switch (schedule.recurrence) {
    case Recurrence.DAILY:
      return "Daily";
    case Recurrence.WEEKLY: {
      const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const names = parseIds(schedule.weekdays)
        .map(Number)
        .filter((d) => d >= 1 && d <= 7)
        .sort((a, b) => a - b)
        .map((d) => labels[d - 1]);
      return names.length ? `Weekly · ${names.join(", ")}` : "Weekly";
    }
    case Recurrence.MONTHLY:
      return `Monthly · day ${schedule.dayOfMonth}`;
    default:
      return "";
  }
}

/** Materialize due occurrences, send claim reminders, auto-assign stragglers. */
export async function runScheduleSweep(familyId: string): Promise<void> {
  // All day-boundary and reminder-hour math happens in the FAMILY's timezone
  // (the server may run in UTC on Vercel).
  const family = await db.family.findUnique({
    where: { id: familyId },
    select: { timezone: true },
  });
  const timeZone = family?.timezone || serverZone();

  await materializeOccurrences(familyId, timeZone);
  await sendClaimReminders(familyId);
  await autoAssignUnclaimed(familyId);
}

async function materializeOccurrences(familyId: string, timeZone: string): Promise<void> {
  const schedules = await db.schedule.findMany({
    where: { familyId, status: ScheduleStatus.ACTIVE },
    include: { chore: true, assignees: true },
  });
  const horizon = addDaysInZone(new Date(), MATERIALIZE_AHEAD_DAYS, timeZone);

  for (const schedule of schedules) {
    let cursor: Date;
    if (schedule.lastMaterialized) {
      cursor = addDaysInZone(schedule.lastMaterialized, 1, timeZone);
    } else {
      cursor = startOfDayInZone(schedule.createdAt, timeZone);
    }

    // Optional end date: no occurrences after it.
    const limit = schedule.endDate && schedule.endDate < horizon
      ? startOfDayInZone(schedule.endDate, timeZone)
      : horizon;

    let iterations = 0;
    while (cursor <= limit && iterations < 400) {
      if (occursOn(schedule, cursor, timeZone)) {
        const hour = Math.max(schedule.reminderHour, 0);
        const cursorParts = zonedParts(cursor, timeZone);
        const dueDate = zonedTimeToUtc(
          cursorParts.year, cursorParts.month, cursorParts.day, hour, timeZone);
        const nextDay = addDaysInZone(cursor, 1, timeZone);

        if (schedule.assignees.length === 0) {
          // OPEN schedule: one unclaimed occurrence per day, first come first serve.
          const existing = await db.assignment.findFirst({
            where: { scheduleId: schedule.id, dueDate: { gte: cursor, lt: nextDay } },
          });
          if (!existing) {
            await db.assignment.create({
              data: {
                choreId: schedule.choreId,
                scheduleId: schedule.id,
                assigneeId: null,
                assignedById: schedule.createdById,
                dueDate,
                reminderHour: schedule.reminderHour,
                baseAmountCents: schedule.chore.amountCents,
              },
            });
          }
        } else {
          for (const { memberId } of schedule.assignees) {
            const existing = await db.assignment.findFirst({
              where: {
                scheduleId: schedule.id,
                assigneeId: memberId,
                dueDate: { gte: cursor, lt: nextDay },
              },
            });
            if (!existing) {
              await db.assignment.create({
                data: {
                  choreId: schedule.choreId,
                  scheduleId: schedule.id,
                  assigneeId: memberId,
                  assignedById: schedule.createdById,
                  dueDate,
                  reminderHour: schedule.reminderHour,
                  baseAmountCents: schedule.chore.amountCents,
                },
              });
            }
          }
        }
      }
      iterations += 1;
      cursor = addDaysInZone(cursor, 1, timeZone);
    }

    await db.schedule.update({
      where: { id: schedule.id },
      data: { lastMaterialized: horizon },
    });
  }
}

async function sendClaimReminders(familyId: string): Promise<void> {
  const now = new Date();
  const reminderWindow = new Date(now.getTime() + CLAIM_REMINDER_MS);

  const due = await db.assignment.findMany({
    where: {
      chore: { familyId },
      assigneeId: null,
      status: AssignmentStatus.PENDING,
      claimRemindedAt: null,
      dueDate: { lte: reminderWindow },
    },
    include: { chore: { include: { event: true } } },
  });

  for (const assignment of due) {
    await db.assignment.update({
      where: { id: assignment.id },
      data: { claimRemindedAt: now },
    });
    await notifyFamily(
      familyId,
      NotificationType.CLAIM_REMINDER,
      "Chore up for grabs! 🙋",
      `"${assignment.chore.title}" (${fmtMoney(assignment.baseAmountCents)}) is due ${
        assignment.dueDate ? fmtDateTime(assignment.dueDate) : "soon"
      } and nobody has claimed it yet. First to claim it earns it!`,
      assignment.id,
      parseIds(assignment.chore.event?.excludedIds ?? ""), // keep surprises secret
    );
  }
}

async function autoAssignUnclaimed(familyId: string): Promise<void> {
  const now = new Date();

  const candidates = await db.assignment.findMany({
    where: {
      chore: { familyId },
      assigneeId: null,
      status: AssignmentStatus.PENDING,
      claimRemindedAt: { not: null },
    },
    include: { chore: { include: { event: true } } },
  });

  const ready = candidates.filter((a) => {
    const remindedLongAgo =
      a.claimRemindedAt && now.getTime() - a.claimRemindedAt.getTime() >= AUTO_ASSIGN_AFTER_MS;
    const dueSoon = a.dueDate && a.dueDate.getTime() - now.getTime() <= AUTO_ASSIGN_AFTER_MS;
    return remindedLongAgo || dueSoon;
  });
  if (ready.length === 0) return;

  const members = await db.member.findMany({ where: { familyId } });

  for (const assignment of ready) {
    // Fairness: whoever has the fewest open chores gets it.
    const openCounts = await db.assignment.groupBy({
      by: ["assigneeId"],
      where: {
        chore: { familyId },
        status: AssignmentStatus.PENDING,
        assigneeId: { not: null },
      },
      _count: { _all: true },
    });
    const countFor = (memberId: string) =>
      openCounts.find((c) => c.assigneeId === memberId)?._count._all ?? 0;
    const excludedIds = parseIds(assignment.chore.event?.excludedIds ?? "");
    const eligible = members.filter((m) => !excludedIds.includes(m.id));
    const chosen = [...eligible].sort((a, b) => countFor(a.id) - countFor(b.id))[0];
    if (!chosen) continue;

    await db.assignment.update({
      where: { id: assignment.id },
      data: { assigneeId: chosen.id, autoAssigned: true },
    });
    await notifyFamily(
      familyId,
      NotificationType.AUTO_ASSIGNED,
      "Chore auto-assigned 🎯",
      `Nobody claimed "${assignment.chore.title}" (${fmtMoney(assignment.baseAmountCents)}), so it went to ${chosen.name}. Anyone else can still take it over from the Chores page.`,
      assignment.id,
      excludedIds,
    );
  }
}
