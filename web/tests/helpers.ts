import crypto from "node:crypto";
import { db } from "@/lib/db";

/** Creates an isolated family with the given number of parents and kids. */
export async function makeFamily(opts: { parents?: number; kids?: number } = {}) {
  const parentCount = opts.parents ?? 2;
  const kidCount = opts.kids ?? 1;

  const family = await db.family.create({
    data: {
      name: `Test Family ${crypto.randomUUID().slice(0, 8)}`,
      // Match the test machine so sweep day-math assertions hold anywhere.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  const parents = [];
  for (let i = 0; i < parentCount; i++) {
    parents.push(
      await db.member.create({
        data: { familyId: family.id, name: `Parent${i + 1}`, role: "PARENT", isHead: i === 0 },
      }),
    );
  }
  const kids = [];
  for (let i = 0; i < kidCount; i++) {
    kids.push(
      await db.member.create({
        data: { familyId: family.id, name: `Kid${i + 1}`, role: "CHILD" },
      }),
    );
  }
  return { family, parents, kids };
}

export async function makeChore(
  familyId: string,
  createdById: string,
  overrides: Record<string, unknown> = {},
) {
  return db.chore.create({
    data: {
      familyId,
      title: "Test chore",
      amountCents: 500,
      kind: "POOL",
      poolStatus: "ACTIVE",
      createdById,
      ...overrides,
    },
  });
}

export async function makeAssignment(
  choreId: string,
  assigneeId: string | null,
  overrides: Record<string, unknown> = {},
) {
  return db.assignment.create({
    data: {
      choreId,
      assigneeId,
      baseAmountCents: 500,
      ...overrides,
    },
  });
}

export const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
export const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);
export const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
