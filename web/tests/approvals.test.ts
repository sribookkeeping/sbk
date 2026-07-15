import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  approveRequest,
  canDecide,
  rejectRequest,
  submitChoreChange,
  submitExtraPay,
  submitPoolChore,
  submitSchedule,
  submitSkipRequest,
} from "@/lib/approvals";
import { makeFamily, makeChore, makeAssignment, daysFromNow } from "./helpers";

async function pendingRequestFor(familyId: string) {
  const request = await db.approvalRequest.findFirst({
    where: { familyId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  expect(request).not.toBeNull();
  return request!;
}

describe("pool chore approval (requirements 4–6)", () => {
  it("a kid's pool chore needs any one parent's approval", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, kids[0].id, { poolStatus: "PENDING_APPROVAL" });
    await submitPoolChore(chore.id, kids[0]);

    let updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("PENDING_APPROVAL");

    const request = await pendingRequestFor(family.id);
    expect(canDecide(request, parents[0])).toBe(true);
    expect(canDecide(request, kids[0])).toBe(false); // kids never decide

    await approveRequest(request.id, parents[0]);
    updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("ACTIVE");
  });

  it("a parent's pool chore must be approved by the OTHER parent", async () => {
    const { family, parents } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id, { poolStatus: "PENDING_APPROVAL" });
    await submitPoolChore(chore.id, parents[0]);

    const request = await pendingRequestFor(family.id);
    expect(canDecide(request, parents[0])).toBe(false); // requester can't self-approve
    expect(canDecide(request, parents[1])).toBe(true);

    await approveRequest(request.id, parents[0]); // no-op
    let updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("PENDING_APPROVAL");

    await approveRequest(request.id, parents[1]);
    updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("ACTIVE");
  });

  it("a sole parent's own pool chore auto-approves", async () => {
    const { family, parents } = await makeFamily({ parents: 1 });
    const chore = await makeChore(family.id, parents[0].id, { poolStatus: "PENDING_APPROVAL" });
    await submitPoolChore(chore.id, parents[0]);

    const updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("ACTIVE");
    const requests = await db.approvalRequest.findMany({ where: { familyId: family.id } });
    expect(requests).toHaveLength(0);
  });

  it("rejection marks the chore REJECTED", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, kids[0].id, { poolStatus: "PENDING_APPROVAL" });
    await submitPoolChore(chore.id, kids[0]);
    const request = await pendingRequestFor(family.id);

    await rejectRequest(request.id, parents[1]);
    const updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.poolStatus).toBe("REJECTED");
  });
});

describe("schedule approval (requirement 8: BOTH parents)", () => {
  it("a parent's schedule counts them as one approval; the other must confirm", async () => {
    const { family, parents } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id);
    const schedule = await db.schedule.create({
      data: { familyId: family.id, choreId: chore.id, recurrence: "DAILY" },
    });
    await submitSchedule(schedule.id, parents[0]);

    let updated = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.status).toBe("PENDING_APPROVAL");

    const request = await pendingRequestFor(family.id);
    expect(canDecide(request, parents[0])).toBe(false); // already counted
    await approveRequest(request.id, parents[1]);

    updated = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.status).toBe("ACTIVE");
  });

  it("a kid's schedule needs BOTH parents", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, kids[0].id);
    const schedule = await db.schedule.create({
      data: { familyId: family.id, choreId: chore.id, recurrence: "DAILY" },
    });
    await submitSchedule(schedule.id, kids[0]);

    const request = await pendingRequestFor(family.id);
    await approveRequest(request.id, parents[0]);
    let updated = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.status).toBe("PENDING_APPROVAL"); // one of two

    const stillPending = await db.approvalRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(stillPending.status).toBe("PENDING");
    await approveRequest(stillPending.id, parents[1]);
    updated = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.status).toBe("ACTIVE");
  });

  it("two parents approving at the same moment don't lose an approval", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, kids[0].id);
    const schedule = await db.schedule.create({
      data: { familyId: family.id, choreId: chore.id, recurrence: "DAILY" },
    });
    await submitSchedule(schedule.id, kids[0]);
    const request = await pendingRequestFor(family.id);

    // Both parents approve concurrently — the atomic accumulation must record
    // both, so the schedule activates (a lost update would leave it pending).
    await Promise.all([
      approveRequest(request.id, parents[0]),
      approveRequest(request.id, parents[1]),
    ]);

    const updated = await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(updated.status).toBe("ACTIVE");
    const decided = await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(decided.status).toBe("APPROVED");
  });
});

describe("extra pay approval (requirement 9)", () => {
  it("a kid's extra-pay request is approved by a parent", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, kids[0].id);
    const assignment = await makeAssignment(chore.id, kids[0].id, {
      status: "COMPLETED",
      extraAmountCents: 200,
      extraReason: "extra muddy",
    });
    await submitExtraPay(assignment.id, "extra muddy", kids[0]);

    let updated = await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.extraStatus).toBe("PENDING");

    const request = await pendingRequestFor(family.id);
    await approveRequest(request.id, parents[0]);
    updated = await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.extraStatus).toBe("APPROVED");
  });
});

describe("chore edit/delete (both parents; soft delete)", () => {
  it("a two-parent edit is pending until the other parent approves, then applies", async () => {
    const { family, parents } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id, { title: "Old", amountCents: 100 });

    const outcome = await submitChoreChange(
      chore.id,
      { title: "New", amountCents: 250 },
      false,
      parents[0],
    );
    expect(outcome).toBe("pending");
    let updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.title).toBe("Old"); // not yet

    const request = await pendingRequestFor(family.id);
    expect(request.type).toBe("CHORE_EDIT");
    expect(canDecide(request, parents[0])).toBe(false);

    await approveRequest(request.id, parents[1]);
    updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.title).toBe("New");
    expect(updated.amountCents).toBe(250);
  });

  it("a sole parent's edit applies immediately", async () => {
    const { family, parents } = await makeFamily({ parents: 1 });
    const chore = await makeChore(family.id, parents[0].id, { amountCents: 100 });
    const outcome = await submitChoreChange(chore.id, { amountCents: 300 }, false, parents[0]);
    expect(outcome).toBe("applied");
    const updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.amountCents).toBe(300);
  });

  it("a rejected edit leaves the chore untouched", async () => {
    const { family, parents } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id, { title: "Keep me" });
    await submitChoreChange(chore.id, { title: "Nope" }, false, parents[0]);
    const request = await pendingRequestFor(family.id);
    await rejectRequest(request.id, parents[1]);

    const updated = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updated.title).toBe("Keep me");
    const decided = await db.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(decided.status).toBe("REJECTED");
  });

  it("delete is soft: history survives, open work is cancelled, schedules pause", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id);
    const done = await makeAssignment(chore.id, kids[0].id, { status: "COMPLETED" });
    const open = await makeAssignment(chore.id, kids[0].id, { status: "PENDING" });
    const schedule = await db.schedule.create({
      data: { familyId: family.id, choreId: chore.id, recurrence: "DAILY", status: "ACTIVE" },
    });

    await submitChoreChange(chore.id, {}, true, parents[0]);
    const request = await pendingRequestFor(family.id);
    expect(request.type).toBe("CHORE_DELETE");
    await approveRequest(request.id, parents[1]);

    const updatedChore = await db.chore.findUniqueOrThrow({ where: { id: chore.id } });
    expect(updatedChore.deletedAt).not.toBeNull();
    expect(updatedChore.poolStatus).toBe("RETIRED");
    expect(
      (await db.assignment.findUniqueOrThrow({ where: { id: done.id } })).status,
    ).toBe("COMPLETED"); // history kept
    expect(
      (await db.assignment.findUniqueOrThrow({ where: { id: open.id } })).status,
    ).toBe("CANCELLED");
    expect(
      (await db.schedule.findUniqueOrThrow({ where: { id: schedule.id } })).status,
    ).toBe("PAUSED");
  });
});

describe("skip / reschedule (any one parent accepts)", () => {
  it("skip cancels the occurrence once a parent approves", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id);
    const assignment = await makeAssignment(chore.id, kids[0].id, {
      dueDate: daysFromNow(1),
    });

    const outcome = await submitSkipRequest(assignment.id, { skip: true }, "sick today", kids[0]);
    expect(outcome).toBe("pending");

    const request = await pendingRequestFor(family.id);
    expect(request.type).toBe("ASSIGNMENT_SKIP");
    await approveRequest(request.id, parents[0]);

    const updated = await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("reschedule moves the due date once approved", async () => {
    const { family, parents, kids } = await makeFamily();
    const chore = await makeChore(family.id, parents[0].id);
    const assignment = await makeAssignment(chore.id, kids[0].id, { dueDate: daysFromNow(1) });
    const newDue = daysFromNow(3);

    await submitSkipRequest(
      assignment.id,
      { newDueDate: newDue.toISOString() },
      "big test this week",
      kids[0],
    );
    const request = await pendingRequestFor(family.id);
    await approveRequest(request.id, parents[1]);

    const updated = await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe("PENDING");
    expect(updated.dueDate!.getTime()).toBe(new Date(newDue.toISOString()).getTime());
  });

  it("a sole parent's own skip applies immediately", async () => {
    const { family, parents } = await makeFamily({ parents: 1 });
    const chore = await makeChore(family.id, parents[0].id);
    const assignment = await makeAssignment(chore.id, parents[0].id, { dueDate: daysFromNow(1) });

    const outcome = await submitSkipRequest(assignment.id, { skip: true }, "busy", parents[0]);
    expect(outcome).toBe("applied");
    const updated = await db.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(updated.status).toBe("CANCELLED");
  });
});
