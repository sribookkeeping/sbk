"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import {
  submitPoolChore,
  submitExtraPay,
  submitSchedule,
  submitSkipRequest,
} from "@/lib/approvals";
import { parseMoney, fmtMoney, fmtDateTime } from "@/lib/format";
import { tryClaim, tryComplete, tryRelease } from "@/lib/assignments";
import { saveReceipt } from "@/lib/storage";
import { notifyFamily } from "@/lib/notifications";
import { eventForMember, isExcludedFrom } from "@/lib/events";
import {
  AssignmentStatus,
  ChoreKind,
  NotificationType,
  PoolStatus,
  Recurrence,
} from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function parseAssignment(formData: FormData) {
  const dueRaw = String(formData.get("dueDate") ?? "");
  const dueDate = dueRaw ? new Date(dueRaw) : null;
  const reminderHour = parseInt(String(formData.get("reminderHour") ?? "-1"), 10);
  return { dueDate, reminderHour: Number.isFinite(reminderHour) ? reminderHour : -1 };
}

/**
 * Requirement 2–6: create a chore and/or propose it for the pool.
 *
 * Two mutually exclusive radio groups shape every chore:
 *   `assignMode` — "assign" (specific members) | "open" (anyone can claim;
 *                  auto-assigned near the due date if unclaimed)
 *   `dueMode`    — "none" | "once" | "schedule" (recurring; joins the pool and
 *                  needs both parents' approval)
 */
export async function createChore(formData: FormData) {
  const member = await requireMember();

  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const amountCents = parseMoney(String(formData.get("amount") ?? ""));
  const addToPool = formData.get("addToPool") === "on";
  const assigneeIds = formData.getAll("assignees").map(String);
  const dueMode = String(formData.get("dueMode") ?? "once");
  const isSchedule = dueMode === "schedule";
  const openToAnyone = String(formData.get("assignMode") ?? "assign") === "open";

  // Optional event linkage (surprise planning): validate visibility and keep
  // event chores out of the shared pool so excluded members never see them.
  const eventId = String(formData.get("eventId") ?? "").trim() || null;
  const event = eventId ? await eventForMember(eventId, member) : null;
  if (eventId && !event) fail("/chores/new", "Event not found.");

  if (!title) fail("/chores/new", "Give the chore a title.");
  if (amountCents === null || amountCents <= 0) fail("/chores/new", "Enter a valid dollar amount.");
  if (event && isSchedule) {
    fail("/chores/new", "Event chores can't repeat on a schedule — give them a due date instead.");
  }
  if (!isSchedule && !openToAnyone && !addToPool && assigneeIds.length === 0) {
    fail("/chores/new", "Assign the chore to someone, open it for anyone to claim, or add it to the pool.");
  }

  const validAssignees = member.family.members.filter(
    (m) =>
      assigneeIds.includes(m.id) &&
      !m.deactivatedAt &&
      !(event && isExcludedFrom(event, m.id)),
  );
  const { dueDate, reminderHour } = parseAssignment(formData);

  const recurrence = String(formData.get("recurrence") ?? Recurrence.WEEKLY);
  const weekdays = formData.getAll("weekdays").map(String).filter(Boolean);

  if (dueMode === "once" && !dueDate) {
    fail("/chores/new", "Pick the due date, or choose \"No due date\".");
  }
  if (isSchedule) {
    if (!Object.values(Recurrence).includes(recurrence as Recurrence)) {
      fail("/chores/new", "Pick how the schedule repeats.");
    }
    if (recurrence === Recurrence.WEEKLY && weekdays.length === 0) {
      fail("/chores/new", "Pick at least one weekday for the schedule.");
    }
    if (!openToAnyone && validAssignees.length === 0) {
      fail("/chores/new", "Scheduled chores need assignees — or mark it open for anyone to claim.");
    }
  }

  const chore = await db.chore.create({
    data: {
      familyId: member.familyId,
      title,
      details,
      amountCents,
      // A scheduled chore lives in the pool so occurrences reference it.
      // Event chores never join the pool (they'd leak the surprise).
      kind: !event && (addToPool || isSchedule) ? ChoreKind.POOL : ChoreKind.ONE_TIME,
      createdById: member.id,
      eventId: event?.id ?? null,
    },
  });

  if (!event && (addToPool || isSchedule)) {
    await submitPoolChore(chore.id, member);
  }

  if (!isSchedule && openToAnyone) {
    // One unclaimed to-do anyone can claim. With a due date the sweep reminds
    // the family ~24h ahead and auto-assigns if unclaimed; without one it
    // simply stays up for grabs, so tell the family now.
    await db.assignment.create({
      data: {
        choreId: chore.id,
        assigneeId: null,
        assignedById: member.id,
        dueDate: dueMode === "once" ? dueDate : null,
        reminderHour,
        baseAmountCents: amountCents,
      },
    });
    if (dueMode === "none") {
      await notifyFamily(
        member.familyId,
        NotificationType.CLAIM_REMINDER,
        "New chore up for grabs! 🙋",
        `${member.name} posted "${title}" (${fmtMoney(amountCents)}). First to claim it earns it!`,
        undefined,
        event ? [...event.excludedIds.split(",").filter(Boolean)] : [],
      );
    }
  } else if (!isSchedule) {
    for (const assignee of validAssignees) {
      await db.assignment.create({
        data: {
          choreId: chore.id,
          assigneeId: assignee.id,
          assignedById: member.id,
          dueDate: dueMode === "once" ? dueDate : null,
          reminderHour,
          baseAmountCents: amountCents,
        },
      });
    }
  } else {
    const schedule = await db.schedule.create({
      data: {
        familyId: member.familyId,
        choreId: chore.id,
        recurrence,
        weekdays: weekdays.join(","),
        dayOfMonth: Math.min(
          Math.max(parseInt(String(formData.get("dayOfMonth") ?? "1"), 10) || 1, 1),
          31,
        ),
        reminderHour: reminderHour >= 0 ? reminderHour : 18,
        createdById: member.id,
        assignees: openToAnyone
          ? undefined
          : { create: validAssignees.map((m) => ({ memberId: m.id })) },
      },
    });
    await submitSchedule(schedule.id, member);
  }

  await audit(member, AuditAction.CHORE_CREATED, "Chore", chore.id, {
    title,
    amountCents,
    dueMode,
    openToAnyone,
    addToPool,
    eventId: event?.id ?? null,
  });

  revalidatePath("/", "layout");
  redirect(event ? `/events/${event.id}` : "/chores");
}

/** Claim an unclaimed scheduled chore, or take over an auto-assigned one. */
export async function claimAssignment(assignmentId: string) {
  const member = await requireMember();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { chore: { include: { event: true } } },
  });
  if (!assignment || assignment.chore.familyId !== member.familyId) return;
  if (assignment.status !== AssignmentStatus.PENDING) return;
  // Members excluded from the chore's event can't claim it (surprise!).
  if (assignment.chore.event && isExcludedFrom(assignment.chore.event, member.id)) return;
  // Atomic: when two members tap "Claim It" simultaneously, exactly one wins.
  if (!(await tryClaim(assignmentId, member.id))) return;

  await audit(member, AuditAction.ASSIGNMENT_CLAIMED, "Assignment", assignmentId, {
    chore: assignment.chore.title,
    takenOverFrom: assignment.assigneeId,
  });
  revalidatePath("/", "layout");
}

/**
 * Give up a chore you hold: it returns to "up for grabs" so anyone can claim
 * it, and the family is notified. The reminder/auto-assign clock restarts.
 */
export async function giveUpAssignment(assignmentId: string) {
  const member = await requireMember();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { chore: { include: { event: true } } },
  });
  if (!assignment || assignment.chore.familyId !== member.familyId) return;
  if (assignment.assigneeId !== member.id && !isParent(member)) return;

  // Atomic: releasing races with completing/claiming; one transition wins.
  if (!(await tryRelease(assignmentId, member))) return;

  await audit(member, AuditAction.ASSIGNMENT_GIVEN_UP, "Assignment", assignmentId, {
    chore: assignment.chore.title,
  });
  await notifyFamily(
    member.familyId,
    NotificationType.CLAIM_REMINDER,
    "Chore back up for grabs 🙋",
    `${member.name} gave up "${assignment.chore.title}" (${fmtMoney(assignment.baseAmountCents)}). First to claim it earns it!`,
    assignmentId,
    assignment.chore.event ? assignment.chore.event.excludedIds.split(",").filter(Boolean) : [],
  );
  revalidatePath("/", "layout");
}

/** Edit an assignment's due date / reminder (assignee or a parent). */
export async function editAssignment(assignmentId: string, formData: FormData) {
  const member = await requireMember();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { chore: true },
  });
  if (!assignment || assignment.chore.familyId !== member.familyId) {
    fail("/chores", "Assignment not found.");
  }
  if (assignment.status !== AssignmentStatus.PENDING) fail("/chores", "Already completed.");
  if (assignment.assigneeId !== member.id && !isParent(member)) {
    fail("/chores", "Only the assignee (or a parent) can edit this.");
  }

  const { dueDate, reminderHour } = parseAssignment(formData);
  const before = {
    dueDate: assignment.dueDate?.toISOString() ?? null,
    reminderHour: assignment.reminderHour,
  };
  await db.assignment.update({
    where: { id: assignmentId },
    data: { dueDate, reminderHour, claimRemindedAt: null },
  });
  await audit(member, AuditAction.ASSIGNMENT_EDITED, "Assignment", assignmentId, {
    chore: assignment.chore.title,
    before,
    after: { dueDate: dueDate?.toISOString() ?? null, reminderHour },
  });
  revalidatePath("/", "layout");
  redirect("/chores");
}

/**
 * Ask to skip (or reschedule) a chore occurrence; a parent accepts.
 * A sole parent's own request applies immediately.
 */
export async function requestSkip(assignmentId: string, formData: FormData) {
  const member = await requireMember();
  const backPath = `/assignments/${assignmentId}/skip`;

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { chore: true },
  });
  if (!assignment || assignment.chore.familyId !== member.familyId) {
    fail("/chores", "Assignment not found.");
  }
  if (assignment.status !== AssignmentStatus.PENDING) fail("/chores", "Already completed.");
  if (assignment.assigneeId !== member.id && !isParent(member)) {
    fail("/chores", "Only the assignee (or a parent) can ask to skip this.");
  }

  const mode = String(formData.get("mode") ?? "skip");
  const reason = String(formData.get("reason") ?? "").trim();
  const newDueRaw = String(formData.get("newDueDate") ?? "");
  if (!reason) fail(backPath, "Give a reason for the skip/reschedule request.");
  if (mode === "reschedule" && !newDueRaw) fail(backPath, "Pick the new due date.");

  const payload =
    mode === "reschedule" ? { newDueDate: new Date(newDueRaw).toISOString() } : { skip: true };
  const outcome = await submitSkipRequest(assignmentId, payload, reason, member);

  await audit(member, AuditAction.SKIP_REQUESTED, "Assignment", assignmentId, {
    chore: assignment.chore.title,
    mode,
    reason,
    outcome,
  });
  revalidatePath("/", "layout");
  redirect("/chores");
}

/** Requirement 9 (first half): pick up a pool chore for one or more members. */
export async function pickupChore(choreId: string, formData: FormData) {
  const member = await requireMember();

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  if (!chore || chore.familyId !== member.familyId) fail("/chores", "Chore not found.");
  if (chore.kind !== ChoreKind.POOL || chore.poolStatus !== PoolStatus.ACTIVE) {
    fail("/chores", "That chore isn't available.");
  }

  const assigneeIds = formData.getAll("assignees").map(String);
  const validAssignees = member.family.members.filter(
    (m) => assigneeIds.includes(m.id) && !m.deactivatedAt,
  );
  if (validAssignees.length === 0) {
    fail(`/chores/${choreId}/pickup`, "Pick at least one person.");
  }

  const { dueDate, reminderHour } = parseAssignment(formData);
  for (const assignee of validAssignees) {
    await db.assignment.create({
      data: {
        choreId: chore.id,
        assigneeId: assignee.id,
        assignedById: member.id,
        dueDate,
        reminderHour,
        baseAmountCents: chore.amountCents,
      },
    });
  }

  revalidatePath("/", "layout");
  redirect("/chores");
}

/** Requirement 9: complete a chore, optionally requesting extra pay + reason. */
export async function completeAssignment(assignmentId: string, formData: FormData) {
  const member = await requireMember();
  const backPath = `/assignments/${assignmentId}/complete`;

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: { chore: true },
  });
  if (!assignment || assignment.chore.familyId !== member.familyId) {
    fail("/chores", "Assignment not found.");
  }
  if (assignment.assigneeId === null) {
    fail("/chores", "Claim this chore before completing it.");
  }
  if (assignment.assigneeId !== member.id && !isParent(member)) {
    fail("/chores", "Only the assignee (or a parent) can complete this chore.");
  }
  if (assignment.status !== AssignmentStatus.PENDING) {
    fail("/chores", "This chore is already completed.");
  }

  const extraRaw = String(formData.get("extraAmount") ?? "").trim();
  const extraReason = String(formData.get("extraReason") ?? "").trim();
  let extraCents = 0;
  if (extraRaw) {
    const parsed = parseMoney(extraRaw);
    if (parsed === null || parsed < 0) fail(backPath, "Enter a valid extra amount.");
    extraCents = parsed;
  }
  if (extraCents > 0 && !extraReason) {
    fail(backPath, "Explain why the work deserves extra pay.");
  }

  // Photo proof of the finished work is required.
  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    fail(backPath, "A photo of the finished work is required.");
  }
  let proofImage: string;
  try {
    proofImage = await saveReceipt(proof);
  } catch (error) {
    fail(backPath, error instanceof Error ? error.message : "Could not save the proof photo.");
  }

  // Atomic: a double-submitted form flips PENDING → COMPLETED exactly once.
  const won = await tryComplete(assignmentId, {
    extraAmountCents: extraCents,
    extraReason: extraCents > 0 ? extraReason : "",
    proofImage,
  });
  if (!won) fail("/chores", "This chore was already completed.");

  if (extraCents > 0) {
    await submitExtraPay(assignmentId, extraReason, member);
  }

  await audit(member, AuditAction.ASSIGNMENT_COMPLETED, "Assignment", assignmentId, {
    chore: assignment.chore.title,
    baseAmountCents: assignment.baseAmountCents,
    extraCents,
    dueWas: assignment.dueDate ? fmtDateTime(assignment.dueDate) : null,
  });
  revalidatePath("/", "layout");
  redirect("/chores");
}

/** Parents can retire a chore from the pool. */
export async function retireChore(choreId: string) {
  const member = await requireMember();
  if (!isParent(member)) return;

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  if (!chore || chore.familyId !== member.familyId) return;

  await db.chore.update({ where: { id: choreId }, data: { poolStatus: PoolStatus.RETIRED } });
  await audit(member, AuditAction.CHORE_RETIRED, "Chore", choreId, { title: chore.title });
  revalidatePath("/chores");
}
