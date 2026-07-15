import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { occursOn, runScheduleSweep } from "@/lib/schedules";
import { makeFamily, makeChore, daysAgo, hoursAgo } from "./helpers";

describe("occursOn (recurrence math)", () => {
  it("daily fires every day", () => {
    expect(occursOn({ recurrence: "DAILY", weekdays: "", dayOfMonth: 1 }, new Date())).toBe(true);
  });

  it("weekly fires only on the chosen weekdays (1=Sun…7=Sat)", () => {
    const schedule = { recurrence: "WEEKLY", weekdays: "2,4", dayOfMonth: 1 }; // Mon, Wed
    const monday = new Date(2026, 6, 13); // 2026-07-13 is a Monday
    const tuesday = new Date(2026, 6, 14);
    expect(occursOn(schedule, monday)).toBe(true);
    expect(occursOn(schedule, tuesday)).toBe(false);
  });

  it("monthly clamps day 31 to the last day of shorter months", () => {
    const schedule = { recurrence: "MONTHLY", weekdays: "", dayOfMonth: 31 };
    expect(occursOn(schedule, new Date(2026, 1, 28))).toBe(true); // Feb 28 2026 (non-leap)
    expect(occursOn(schedule, new Date(2026, 1, 27))).toBe(false);
    expect(occursOn(schedule, new Date(2026, 0, 31))).toBe(true);
  });
});

describe("schedule sweep: materialize, claim reminders, auto-assign, end date", () => {
  it("materializes one unclaimed occurrence per day for open schedules", async () => {
    const { family, parents } = await makeFamily({ parents: 1, kids: 0 });
    const chore = await makeChore(family.id, parents[0].id);
    const schedule = await db.schedule.create({
      data: {
        familyId: family.id,
        choreId: chore.id,
        recurrence: "DAILY",
        reminderHour: 9,
        status: "ACTIVE",
      },
    });

    await runScheduleSweep(family.id);
    // today + 2 days ahead = 3 occurrences, each a single claimable row
    const occurrences = await db.assignment.findMany({
      where: { scheduleId: schedule.id },
    });
    expect(occurrences.length).toBe(3);

    // idempotent: a second sweep must not duplicate
    await runScheduleSweep(family.id);
    expect((await db.assignment.findMany({ where: { scheduleId: schedule.id } })).length).toBe(3);
  });

  it("reminds the family ~24h before the due date, then auto-assigns fairly after 12h", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 2, kids: 2 });
    const chore = await makeChore(family.id, parents[0].id);
    // Unclaimed occurrence due in 20h: inside the 24h reminder window but
    // outside the 12h auto-assign fallback.
    const occurrence = await db.assignment.create({
      data: {
        choreId: chore.id,
        assigneeId: null,
        baseAmountCents: 500,
        dueDate: hoursAgo(-20),
      },
    });

    await runScheduleSweep(family.id);
    let updated = await db.assignment.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(updated.claimRemindedAt).not.toBeNull(); // reminder sent
    expect(updated.assigneeId).toBeNull(); // but NOT auto-assigned yet
    const reminders = await db.notification.findMany({
      where: { familyId: family.id, type: "CLAIM_REMINDER", assignmentId: occurrence.id },
    });
    expect(reminders.length).toBe(4); // whole family: 2 parents + 2 kids

    // Give kid1 lots of open chores so fairness picks someone else
    for (let i = 0; i < 3; i++) {
      await db.assignment.create({
        data: { choreId: chore.id, assigneeId: kids[0].id, baseAmountCents: 1, status: "PENDING" },
      });
    }

    // Nobody claimed for >12h since the reminder → auto-assign on the next sweep
    await db.assignment.update({
      where: { id: occurrence.id },
      data: { claimRemindedAt: hoursAgo(13) },
    });
    await runScheduleSweep(family.id);

    updated = await db.assignment.findUniqueOrThrow({ where: { id: occurrence.id } });
    expect(updated.assigneeId).not.toBeNull();
    expect(updated.autoAssigned).toBe(true);
    expect(updated.assigneeId).not.toBe(kids[0].id); // fairness: not the busiest member

    const autoNotices = await db.notification.findMany({
      where: { familyId: family.id, type: "AUTO_ASSIGNED", assignmentId: occurrence.id },
    });
    expect(autoNotices.length).toBe(4);
  });

  it("never auto-assigns a surprise-event chore to an excluded member", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 1, kids: 1 });
    const event = await db.event.create({
      data: { familyId: family.id, title: "Surprise", excludedIds: kids[0].id },
    });
    const chore = await makeChore(family.id, parents[0].id, { eventId: event.id });
    await db.assignment.create({
      data: {
        choreId: chore.id,
        assigneeId: null,
        baseAmountCents: 500,
        dueDate: hoursAgo(-6), // due in 6h
        claimRemindedAt: hoursAgo(13),
      },
    });

    await runScheduleSweep(family.id);
    const assigned = await db.assignment.findFirstOrThrow({
      where: { choreId: chore.id },
    });
    // Only the parent is eligible — the excluded kid must never get it
    expect(assigned.assigneeId).toBe(parents[0].id);
  });

  it("stops materializing after the schedule's end date", async () => {
    const { family, parents } = await makeFamily({ parents: 1 });
    const chore = await makeChore(family.id, parents[0].id);
    await db.schedule.create({
      data: {
        familyId: family.id,
        choreId: chore.id,
        recurrence: "DAILY",
        status: "ACTIVE",
        createdAt: daysAgo(5),
        endDate: daysAgo(3),
        assignees: { create: [{ memberId: parents[0].id }] },
      },
    });

    await runScheduleSweep(family.id);
    const occurrences = await db.assignment.findMany({ where: { choreId: chore.id } });
    // days -5, -4, -3 → 3 occurrences; nothing after the end date
    expect(occurrences.length).toBe(3);
    const latest = Math.max(...occurrences.map((a) => a.dueDate!.getTime()));
    expect(latest).toBeLessThanOrEqual(daysAgo(3).getTime() + 24 * 60 * 60 * 1000);
  });
});
