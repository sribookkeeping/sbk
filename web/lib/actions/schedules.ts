"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent } from "@/lib/auth";
import { submitSchedule } from "@/lib/approvals";
import { audit, AuditAction } from "@/lib/audit";
import { ChoreKind, PoolStatus, Recurrence, ScheduleStatus } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Requirement 8: anyone proposes a schedule; both parents must approve. */
export async function createSchedule(formData: FormData) {
  const member = await requireMember();
  const backPath = "/schedules/new";

  const choreId = String(formData.get("choreId") ?? "");
  const recurrence = String(formData.get("recurrence") ?? Recurrence.WEEKLY);
  const weekdays = formData.getAll("weekdays").map(String).filter(Boolean);
  const dayOfMonth = parseInt(String(formData.get("dayOfMonth") ?? "1"), 10) || 1;
  const reminderHour = parseInt(String(formData.get("reminderHour") ?? "18"), 10);
  const assigneeIds = formData.getAll("assignees").map(String);

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  if (
    !chore ||
    chore.familyId !== member.familyId ||
    chore.kind !== ChoreKind.POOL ||
    chore.poolStatus !== PoolStatus.ACTIVE
  ) {
    fail(backPath, "Pick an active pool chore to schedule.");
  }

  const openToAnyone =
    String(formData.get("assignMode") ?? "") === "open" ||
    formData.get("openToAnyone") === "on";
  const validAssignees = member.family.members.filter((m) => assigneeIds.includes(m.id));
  if (!openToAnyone && validAssignees.length === 0) {
    fail(backPath, "Pick at least one person — or mark it open for anyone to claim.");
  }
  if (recurrence === Recurrence.WEEKLY && weekdays.length === 0) {
    fail(backPath, "Pick at least one weekday.");
  }

  const endRaw = String(formData.get("endDate") ?? "");
  const schedule = await db.schedule.create({
    data: {
      familyId: member.familyId,
      choreId: chore.id,
      recurrence,
      weekdays: weekdays.join(","),
      dayOfMonth: Math.min(Math.max(dayOfMonth, 1), 31),
      reminderHour,
      endDate: endRaw ? new Date(endRaw) : null,
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
    endDate: endRaw || null,
  });
  revalidatePath("/", "layout");
  redirect("/schedules");
}

async function parentScheduleAction(scheduleId: string, status: string | null) {
  const member = await requireMember();
  if (!isParent(member)) return;

  const schedule = await db.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || schedule.familyId !== member.familyId) return;

  if (status === null) {
    await db.schedule.delete({ where: { id: scheduleId } });
  } else {
    await db.schedule.update({ where: { id: scheduleId }, data: { status } });
  }
  await audit(member, AuditAction.SCHEDULE_CHANGED, "Schedule", scheduleId, {
    change: status === null ? "deleted" : status,
  });
  revalidatePath("/schedules");
}

export async function pauseSchedule(scheduleId: string) {
  await parentScheduleAction(scheduleId, ScheduleStatus.PAUSED);
}

export async function resumeSchedule(scheduleId: string) {
  await parentScheduleAction(scheduleId, ScheduleStatus.ACTIVE);
}

export async function deleteSchedule(scheduleId: string) {
  await parentScheduleAction(scheduleId, null);
}
