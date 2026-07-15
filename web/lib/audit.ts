import { db } from "@/lib/db";

// Family activity audit. Every mutating action records an entry; parents see
// them on /audit, platform admins across families on /admin. When an admin is
// impersonating a member, impersonatorId records who was really driving.

export const AuditAction = {
  CHORE_CREATED: "CHORE_CREATED",
  CHORE_EDIT_PROPOSED: "CHORE_EDIT_PROPOSED",
  CHORE_EDITED: "CHORE_EDITED",
  CHORE_DELETE_PROPOSED: "CHORE_DELETE_PROPOSED",
  CHORE_DELETED: "CHORE_DELETED",
  CHORE_RETIRED: "CHORE_RETIRED",
  ASSIGNMENT_CREATED: "ASSIGNMENT_CREATED",
  ASSIGNMENT_CLAIMED: "ASSIGNMENT_CLAIMED",
  ASSIGNMENT_GIVEN_UP: "ASSIGNMENT_GIVEN_UP",
  ASSIGNMENT_EDITED: "ASSIGNMENT_EDITED",
  ASSIGNMENT_COMPLETED: "ASSIGNMENT_COMPLETED",
  ASSIGNMENT_AUTO_ASSIGNED: "ASSIGNMENT_AUTO_ASSIGNED",
  SKIP_REQUESTED: "SKIP_REQUESTED",
  SKIP_DECIDED: "SKIP_DECIDED",
  EXTRA_PAY_REQUESTED: "EXTRA_PAY_REQUESTED",
  APPROVAL_DECIDED: "APPROVAL_DECIDED",
  SCHEDULE_CREATED: "SCHEDULE_CREATED",
  SCHEDULE_CHANGED: "SCHEDULE_CHANGED",
  EXPENSE_CREATED: "EXPENSE_CREATED",
  EXPENSE_EDITED: "EXPENSE_EDITED",
  EXPENSE_DELETED: "EXPENSE_DELETED",
  PAYOUT_RECORDED: "PAYOUT_RECORDED",
  EVENT_CREATED: "EVENT_CREATED",
  EVENT_REVEALED: "EVENT_REVEALED",
  MEMBER_ADDED: "MEMBER_ADDED",
  MEMBER_SIGNED_IN: "MEMBER_SIGNED_IN",
  PASSWORD_RESET: "PASSWORD_RESET",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  FAMILY_UPDATED: "FAMILY_UPDATED",
  REPORT_FREQUENCY_CHANGED: "REPORT_FREQUENCY_CHANGED",
  IMPERSONATION_STARTED: "IMPERSONATION_STARTED",
  IMPERSONATION_ENDED: "IMPERSONATION_ENDED",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

type Actor = { id: string; name: string; familyId: string; impersonatorId?: string | null };

export async function audit(
  actor: Actor,
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.auditLog.create({
    data: {
      familyId: actor.familyId,
      actorId: actor.id,
      actorName: actor.name,
      impersonatorId: actor.impersonatorId ?? null,
      action,
      entityType,
      entityId,
      details: JSON.stringify(details),
    },
  });
}

export async function familyAudit(familyId: string, take = 200) {
  return db.auditLog.findMany({
    where: { familyId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Human-readable label for an audit action. */
export function auditLabel(action: string): string {
  return action
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}
