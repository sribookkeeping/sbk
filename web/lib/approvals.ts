import { db } from "@/lib/db";
import {
  ApprovalStatus,
  ApprovalType,
  AssignmentStatus,
  ExtraStatus,
  PoolStatus,
  Role,
  ScheduleStatus,
} from "@/lib/types";

// The family's approval rules — identical to the iOS app's ApprovalService:
//  - A kid's new pool chore needs any one parent's approval.
//  - A parent's new pool chore needs the OTHER parent's approval.
//  - A schedule needs BOTH parents (the creating parent counts as approved).
//  - Extra-pay requests need a parent other than the requester.
//  - In a single-parent family, that parent's own submissions auto-approve.

export function parseIds(csv: string): string[] {
  return csv.split(",").filter(Boolean);
}

export function joinIds(ids: string[]): string {
  return ids.join(",");
}

type MemberLite = { id: string; role: string; familyId: string };

async function familyParents(familyId: string) {
  // Only ACTIVE parents gate approvals — a deactivated parent must never be a
  // required approver, or a "both parents" request could never complete.
  return db.member.findMany({
    where: { familyId, role: Role.PARENT, deactivatedAt: null },
  });
}

// MARK: submitting requests

export async function submitPoolChore(choreId: string, creator: MemberLite): Promise<void> {
  const parentMembers = await familyParents(creator.familyId);
  const otherParents = parentMembers.filter((p) => p.id !== creator.id);

  if (creator.role === Role.PARENT && otherParents.length === 0) {
    await db.chore.update({ where: { id: choreId }, data: { poolStatus: PoolStatus.ACTIVE } });
    return;
  }

  await db.chore.update({
    where: { id: choreId },
    data: { poolStatus: PoolStatus.PENDING_APPROVAL },
  });
  await db.approvalRequest.create({
    data: {
      familyId: creator.familyId,
      type: ApprovalType.POOL_CHORE,
      requestedById: creator.id,
      choreId,
    },
  });
}

export async function submitSchedule(scheduleId: string, creator: MemberLite): Promise<void> {
  const parentMembers = await familyParents(creator.familyId);
  const approved = creator.role === Role.PARENT ? [creator.id] : [];
  const parentIds = parentMembers.map((p) => p.id);
  const allApproved = parentIds.every((id) => approved.includes(id));

  if (parentIds.length === 0 || allApproved) {
    await db.schedule.update({
      where: { id: scheduleId },
      data: { status: ScheduleStatus.ACTIVE, approvedByIds: joinIds(approved) },
    });
    return;
  }

  await db.schedule.update({
    where: { id: scheduleId },
    data: { status: ScheduleStatus.PENDING_APPROVAL, approvedByIds: joinIds(approved) },
  });
  await db.approvalRequest.create({
    data: {
      familyId: creator.familyId,
      type: ApprovalType.SCHEDULE,
      requiresBothParents: true,
      approvedByIds: joinIds(approved),
      requestedById: creator.id,
      scheduleId,
    },
  });
}

export async function submitExtraPay(
  assignmentId: string,
  reason: string,
  requester: MemberLite,
): Promise<void> {
  const parentMembers = await familyParents(requester.familyId);
  const eligible = parentMembers.filter((p) => p.id !== requester.id);

  if (requester.role === Role.PARENT && eligible.length === 0) {
    await db.assignment.update({
      where: { id: assignmentId },
      data: { extraStatus: ExtraStatus.APPROVED },
    });
    return;
  }

  await db.assignment.update({
    where: { id: assignmentId },
    data: { extraStatus: ExtraStatus.PENDING },
  });
  await db.approvalRequest.create({
    data: {
      familyId: requester.familyId,
      type: ApprovalType.EXTRA_PAY,
      note: reason,
      requestedById: requester.id,
      assignmentId,
    },
  });
}

// MARK: chore edit / delete (both parents must approve)

export type ChoreEditPayload = { title?: string; details?: string; amountCents?: number };

async function applyChoreEdit(choreId: string, changes: ChoreEditPayload): Promise<void> {
  await db.chore.update({
    where: { id: choreId },
    data: {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.details !== undefined ? { details: changes.details } : {}),
      ...(changes.amountCents !== undefined ? { amountCents: changes.amountCents } : {}),
    },
  });
}

async function applyChoreDelete(choreId: string): Promise<void> {
  // Soft delete keeps completed history (and the ledger) intact.
  await db.chore.update({
    where: { id: choreId },
    data: { deletedAt: new Date(), poolStatus: PoolStatus.RETIRED },
  });
  await db.assignment.updateMany({
    where: { choreId, status: AssignmentStatus.PENDING },
    data: { status: AssignmentStatus.CANCELLED },
  });
  await db.schedule.updateMany({
    where: { choreId, status: { in: [ScheduleStatus.ACTIVE, ScheduleStatus.PENDING_APPROVAL] } },
    data: { status: ScheduleStatus.PAUSED },
  });
}

/**
 * Propose an edit (or delete, with empty changes) to a chore. Parents only.
 * Both parents must approve; the proposer counts as one. In a single-parent
 * family the change applies immediately. Returns "applied" or "pending".
 */
export async function submitChoreChange(
  choreId: string,
  changes: ChoreEditPayload,
  isDelete: boolean,
  proposer: MemberLite,
): Promise<"applied" | "pending"> {
  const parentMembers = await familyParents(proposer.familyId);
  const approved = proposer.role === Role.PARENT ? [proposer.id] : [];
  const allApproved =
    parentMembers.length > 0 && parentMembers.every((p) => approved.includes(p.id));

  if (allApproved) {
    if (isDelete) await applyChoreDelete(choreId);
    else await applyChoreEdit(choreId, changes);
    return "applied";
  }

  await db.approvalRequest.create({
    data: {
      familyId: proposer.familyId,
      type: isDelete ? ApprovalType.CHORE_DELETE : ApprovalType.CHORE_EDIT,
      requiresBothParents: true,
      approvedByIds: joinIds(approved),
      payload: JSON.stringify(changes),
      requestedById: proposer.id,
      choreId,
    },
  });
  return "pending";
}

// MARK: skip / reschedule an assignment (any one parent decides)

export type SkipPayload = { skip?: boolean; newDueDate?: string };

/** Requirement: assignee may ask to skip or reschedule; a parent accepts. */
export async function submitSkipRequest(
  assignmentId: string,
  payload: SkipPayload,
  reason: string,
  requester: MemberLite,
): Promise<"applied" | "pending"> {
  const parentMembers = await familyParents(requester.familyId);
  const eligible = parentMembers.filter((p) => p.id !== requester.id);

  if (requester.role === Role.PARENT && eligible.length === 0) {
    await applySkip(assignmentId, payload);
    return "applied";
  }

  await db.approvalRequest.create({
    data: {
      familyId: requester.familyId,
      type: ApprovalType.ASSIGNMENT_SKIP,
      note: reason,
      payload: JSON.stringify(payload),
      requestedById: requester.id,
      assignmentId,
    },
  });
  return "pending";
}

async function applySkip(assignmentId: string, payload: SkipPayload): Promise<void> {
  if (payload.newDueDate) {
    await db.assignment.update({
      where: { id: assignmentId },
      data: { dueDate: new Date(payload.newDueDate), claimRemindedAt: null },
    });
  } else {
    await db.assignment.update({
      where: { id: assignmentId },
      data: { status: AssignmentStatus.CANCELLED },
    });
  }
}

export function requestPayload<T>(request: { payload: string }): T | null {
  try {
    return request.payload ? (JSON.parse(request.payload) as T) : null;
  } catch {
    return null;
  }
}

// MARK: deciding

type RequestLite = {
  status: string;
  approvedByIds: string;
  requiresBothParents: boolean;
  requestedById: string | null;
};

/** Whether `member` may approve/reject this request right now. */
export function canDecide(request: RequestLite, member: MemberLite): boolean {
  if (request.status !== ApprovalStatus.PENDING || member.role !== Role.PARENT) return false;
  // Already gave their approval (covers the creating parent on schedules).
  if (parseIds(request.approvedByIds).includes(member.id)) return false;
  // Single-approver requests can never be decided by the requester —
  // this is what makes "the other parent approves" work.
  if (!request.requiresBothParents && request.requestedById === member.id) return false;
  return true;
}

export async function approveRequest(requestId: string, member: MemberLite): Promise<void> {
  // Append this parent's approval ATOMICALLY: re-read the row inside a
  // transaction and write the accumulated list. Without this, two parents
  // approving a "both parents" request at the same moment would each read the
  // empty list and one write would clobber the other — losing an approval so
  // the schedule/edit never activates. (On Postgres, deploy with Serializable
  // isolation; on SQLite the single writer already serializes these.)
  const result = await db.$transaction(async (tx) => {
    const current = await tx.approvalRequest.findUnique({ where: { id: requestId } });
    if (!current || current.familyId !== member.familyId || !canDecide(current, member)) {
      return null;
    }
    const approvedBy = [...parseIds(current.approvedByIds), member.id];
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: { approvedByIds: joinIds(approvedBy) },
    });
    return { request: current, approvedBy };
  });
  if (!result) return;
  const { request, approvedBy } = result;

  switch (request.type) {
    case ApprovalType.POOL_CHORE: {
      if (!(await finalize(requestId, approvedBy, true))) return;
      if (request.choreId) {
        await db.chore.update({
          where: { id: request.choreId },
          data: { poolStatus: PoolStatus.ACTIVE },
        });
      }
      break;
    }
    case ApprovalType.EXTRA_PAY: {
      if (!(await finalize(requestId, approvedBy, true))) return;
      if (request.assignmentId) {
        await db.assignment.update({
          where: { id: request.assignmentId },
          data: { extraStatus: ExtraStatus.APPROVED },
        });
      }
      break;
    }
    case ApprovalType.SCHEDULE: {
      const parentMembers = await familyParents(member.familyId);
      const allApproved = parentMembers.every((p) => approvedBy.includes(p.id));
      if (request.scheduleId) {
        await db.schedule.update({
          where: { id: request.scheduleId },
          data: {
            approvedByIds: joinIds(approvedBy),
            ...(allApproved ? { status: ScheduleStatus.ACTIVE } : {}),
          },
        });
      }
      // (approvedByIds was already persisted atomically in the transaction.)
      if (allApproved) {
        await finalize(requestId, approvedBy, true);
      }
      break;
    }
    case ApprovalType.CHORE_EDIT:
    case ApprovalType.CHORE_DELETE: {
      const parentMembers = await familyParents(member.familyId);
      const allApproved = parentMembers.every((p) => approvedBy.includes(p.id));
      if (allApproved) {
        // Finalize FIRST (conditionally) so a concurrent double-approve can
        // never apply the edit/delete twice.
        if (!(await finalize(requestId, approvedBy, true))) return;
        if (request.choreId) {
          if (request.type === ApprovalType.CHORE_DELETE) {
            await applyChoreDelete(request.choreId);
          } else {
            await applyChoreEdit(
              request.choreId,
              requestPayload<ChoreEditPayload>(request) ?? {},
            );
          }
        }
      }
      break;
    }
    case ApprovalType.ASSIGNMENT_SKIP: {
      if (!(await finalize(requestId, approvedBy, true))) return;
      if (request.assignmentId) {
        await applySkip(request.assignmentId, requestPayload<SkipPayload>(request) ?? {});
      }
      break;
    }
  }
}

export async function rejectRequest(requestId: string, member: MemberLite): Promise<void> {
  const request = await db.approvalRequest.findUnique({ where: { id: requestId } });
  if (!request || request.familyId !== member.familyId || !canDecide(request, member)) return;

  if (!(await finalize(requestId, parseIds(request.approvedByIds), false))) return;

  if (request.type === ApprovalType.POOL_CHORE && request.choreId) {
    await db.chore.update({
      where: { id: request.choreId },
      data: { poolStatus: PoolStatus.REJECTED },
    });
  }
  if (request.type === ApprovalType.EXTRA_PAY && request.assignmentId) {
    await db.assignment.update({
      where: { id: request.assignmentId },
      data: { extraStatus: ExtraStatus.DENIED },
    });
  }
  if (request.type === ApprovalType.SCHEDULE && request.scheduleId) {
    await db.schedule.update({
      where: { id: request.scheduleId },
      data: { status: ScheduleStatus.REJECTED },
    });
  }
}

/**
 * Flip a request out of PENDING exactly once (conditional update). Returns
 * true only for the caller that won — concurrent double-decides lose, so the
 * entity side-effects (crediting extra pay, applying edits…) run once.
 */
async function finalize(
  requestId: string,
  approvedBy: string[],
  approved: boolean,
): Promise<boolean> {
  const result = await db.approvalRequest.updateMany({
    where: { id: requestId, status: ApprovalStatus.PENDING },
    data: {
      status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      approvedByIds: joinIds(approvedBy),
      decidedAt: new Date(),
    },
  });
  return result.count === 1;
}

/** Requests in the family, newest first, with the relations the UI shows. */
export async function familyRequests(familyId: string) {
  return db.approvalRequest.findMany({
    where: { familyId },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: true,
      chore: true,
      schedule: { include: { chore: true } },
      assignment: { include: { chore: true } },
    },
  });
}

export type FamilyRequest = Awaited<ReturnType<typeof familyRequests>>[number];

export function requestHeadline(request: FamilyRequest): string {
  switch (request.type) {
    case ApprovalType.POOL_CHORE:
      return `Add "${request.chore?.title ?? "chore"}" to the chore pool`;
    case ApprovalType.SCHEDULE:
      return `Schedule "${request.schedule?.chore?.title ?? "chore"}"`;
    case ApprovalType.EXTRA_PAY:
      return `Extra pay for "${request.assignment?.chore?.title ?? "chore"}"`;
    case ApprovalType.CHORE_EDIT:
      return `Edit "${request.chore?.title ?? "chore"}"`;
    case ApprovalType.CHORE_DELETE:
      return `Delete "${request.chore?.title ?? "chore"}"`;
    case ApprovalType.ASSIGNMENT_SKIP: {
      const payload = requestPayload<SkipPayload>(request);
      const what = payload?.newDueDate ? "Reschedule" : "Skip";
      return `${what} "${request.assignment?.chore?.title ?? "chore"}"`;
    }
    default:
      return "Request";
  }
}

export function requestAmountCents(request: FamilyRequest): number | null {
  switch (request.type) {
    case ApprovalType.POOL_CHORE:
      return request.chore?.amountCents ?? null;
    case ApprovalType.SCHEDULE:
      return request.schedule?.chore?.amountCents ?? null;
    case ApprovalType.EXTRA_PAY:
      return request.assignment?.extraAmountCents ?? null;
    case ApprovalType.CHORE_EDIT: {
      const payload = requestPayload<ChoreEditPayload>(request);
      return payload?.amountCents ?? null;
    }
    default:
      return null;
  }
}
