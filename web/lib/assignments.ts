import { db } from "@/lib/db";
import { AssignmentStatus } from "@/lib/types";

// Atomic, race-safe assignment state changes. Two members tapping "Claim It"
// at the same moment must produce exactly one winner, and a double-submitted
// completion must credit exactly once — so every transition here is a
// conditional UPDATE (count tells us who won), never read-then-write.

/**
 * Claim an unclaimed occurrence, or take over an auto-assigned one.
 * Returns true if THIS call won the claim.
 */
export async function tryClaim(assignmentId: string, memberId: string): Promise<boolean> {
  const result = await db.assignment.updateMany({
    where: {
      id: assignmentId,
      status: AssignmentStatus.PENDING,
      OR: [
        { assigneeId: null },
        { autoAssigned: true, NOT: { assigneeId: memberId } },
      ],
    },
    data: { assigneeId: memberId, assignedById: memberId },
  });
  return result.count === 1;
}

/**
 * Give up a held assignment back to "up for grabs". Parents may release any
 * held assignment; members only their own. Returns true if released.
 */
export async function tryRelease(
  assignmentId: string,
  member: { id: string; role: string },
): Promise<boolean> {
  const result = await db.assignment.updateMany({
    where: {
      id: assignmentId,
      status: AssignmentStatus.PENDING,
      assigneeId: member.role === "PARENT" ? { not: null } : member.id,
    },
    data: { assigneeId: null, autoAssigned: false, claimRemindedAt: null },
  });
  return result.count === 1;
}

/**
 * Flip a pending assignment to COMPLETED exactly once (double submits lose).
 * The caller records extra-pay/proof details through `data`.
 */
export async function tryComplete(
  assignmentId: string,
  data: {
    extraAmountCents: number;
    extraReason: string;
    proofImage: string;
  },
): Promise<boolean> {
  const result = await db.assignment.updateMany({
    where: { id: assignmentId, status: AssignmentStatus.PENDING, assigneeId: { not: null } },
    data: {
      status: AssignmentStatus.COMPLETED,
      completedAt: new Date(),
      ...data,
    },
  });
  return result.count === 1;
}
