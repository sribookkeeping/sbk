import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { tryClaim, tryComplete, tryRelease } from "@/lib/assignments";
import { occursOn } from "@/lib/schedules";
import { makeFamily, makeChore, makeAssignment } from "./helpers";

describe("atomic assignment transitions (race-safety)", () => {
  it("two simultaneous claims produce exactly one winner", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 1, kids: 1 });
    const chore = await makeChore(family.id, parents[0].id);
    const open = await makeAssignment(chore.id, null);

    const [first, second] = await Promise.all([
      tryClaim(open.id, kids[0].id),
      tryClaim(open.id, parents[0].id),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1); // exactly one winner

    const row = await db.assignment.findUniqueOrThrow({ where: { id: open.id } });
    expect(row.assigneeId).toBe(first ? kids[0].id : parents[0].id);

    // A regular (non-auto-assigned) held chore can't be claimed away
    expect(await tryClaim(open.id, first ? parents[0].id : kids[0].id)).toBe(false);
  });

  it("auto-assigned chores can be taken over; completed ones cannot be claimed", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 1, kids: 1 });
    const chore = await makeChore(family.id, parents[0].id);
    const auto = await makeAssignment(chore.id, kids[0].id, { autoAssigned: true });

    expect(await tryClaim(auto.id, parents[0].id)).toBe(true); // take-over

    const done = await makeAssignment(chore.id, null, { status: "COMPLETED" });
    expect(await tryClaim(done.id, kids[0].id)).toBe(false);
  });

  it("a double-submitted completion credits exactly once", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 1, kids: 1 });
    const chore = await makeChore(family.id, parents[0].id);
    const held = await makeAssignment(chore.id, kids[0].id);

    const data = { extraAmountCents: 0, extraReason: "", proofImage: "proof.jpg" };
    const [first, second] = await Promise.all([
      tryComplete(held.id, data),
      tryComplete(held.id, data),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    const row = await db.assignment.findUniqueOrThrow({ where: { id: held.id } });
    expect(row.status).toBe("COMPLETED");
  });

  it("an unclaimed occurrence cannot be completed (must claim first)", async () => {
    const { family, parents } = await makeFamily({ parents: 1, kids: 0 });
    const chore = await makeChore(family.id, parents[0].id);
    const open = await makeAssignment(chore.id, null);
    expect(
      await tryComplete(open.id, { extraAmountCents: 0, extraReason: "", proofImage: "p.jpg" }),
    ).toBe(false);
  });

  it("give-up: kids only release their own; parents can release anyone's", async () => {
    const { family, parents, kids } = await makeFamily({ parents: 1, kids: 2 });
    const chore = await makeChore(family.id, parents[0].id);
    const held = await makeAssignment(chore.id, kids[0].id);

    expect(await tryRelease(held.id, kids[1])).toBe(false); // not theirs
    expect(await tryRelease(held.id, kids[0])).toBe(true);
    expect(await tryRelease(held.id, kids[0])).toBe(false); // already unclaimed

    const held2 = await makeAssignment(chore.id, kids[0].id);
    expect(await tryRelease(held2.id, parents[0])).toBe(true); // parent override
  });
});

describe("timezone-aware schedule math", () => {
  it("the same instant is a different weekday in different timezones", () => {
    // 2026-07-13T03:00:00Z = Monday 12:00 in Tokyo, Sunday 20:00 in Los Angeles
    const instant = new Date("2026-07-13T03:00:00Z");
    const mondaySchedule = { recurrence: "WEEKLY", weekdays: "2", dayOfMonth: 1 }; // Mondays

    expect(occursOn(mondaySchedule, instant, "Asia/Tokyo")).toBe(true);
    expect(occursOn(mondaySchedule, instant, "America/Los_Angeles")).toBe(false);
  });

  it("monthly day-of-month respects the timezone's calendar date", () => {
    // 2026-08-01T02:00:00Z is still July 31 in Los Angeles
    const instant = new Date("2026-08-01T02:00:00Z");
    const schedule = { recurrence: "MONTHLY", weekdays: "", dayOfMonth: 31 };

    expect(occursOn(schedule, instant, "America/Los_Angeles")).toBe(true);
    expect(occursOn(schedule, instant, "UTC")).toBe(false); // Aug 1 in UTC
  });
});
