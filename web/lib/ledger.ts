import { db } from "@/lib/db";
import { AssignmentStatus, ExtraStatus } from "@/lib/types";

// Earnings vs. expenses vs. payouts math (requirement 11 + payouts):
//   balance = earned − spent − paid out

export type MemberBalance = {
  earnedCents: number;
  spentCents: number;
  paidOutCents: number;
  balanceCents: number;
  pendingExtraCents: number;
};

export async function familyBalances(familyId: string): Promise<Map<string, MemberBalance>> {
  const [assignments, expenses, payouts, members] = await Promise.all([
    db.assignment.findMany({
      where: { chore: { familyId } },
      select: {
        assigneeId: true,
        status: true,
        baseAmountCents: true,
        extraAmountCents: true,
        extraStatus: true,
      },
    }),
    db.expense.findMany({ where: { familyId }, select: { memberId: true, amountCents: true } }),
    db.payout.findMany({ where: { familyId }, select: { memberId: true, amountCents: true } }),
    db.member.findMany({ where: { familyId }, select: { id: true } }),
  ]);

  const balances = new Map<string, MemberBalance>();
  for (const member of members) {
    balances.set(member.id, { ...EMPTY_BALANCE });
  }

  for (const a of assignments) {
    if (!a.assigneeId) continue; // unclaimed occurrence — no one earns it yet
    const entry = balances.get(a.assigneeId);
    if (!entry) continue;
    if (a.status === AssignmentStatus.COMPLETED) {
      entry.earnedCents += a.baseAmountCents;
      if (a.extraStatus === ExtraStatus.APPROVED) entry.earnedCents += a.extraAmountCents;
    }
    if (a.extraStatus === ExtraStatus.PENDING) entry.pendingExtraCents += a.extraAmountCents;
  }

  for (const e of expenses) {
    const entry = balances.get(e.memberId);
    if (entry) entry.spentCents += e.amountCents;
  }

  for (const p of payouts) {
    const entry = balances.get(p.memberId);
    if (entry) entry.paidOutCents += p.amountCents;
  }

  for (const entry of balances.values()) {
    entry.balanceCents = entry.earnedCents - entry.spentCents - entry.paidOutCents;
  }
  return balances;
}

export const EMPTY_BALANCE: MemberBalance = {
  earnedCents: 0,
  spentCents: 0,
  paidOutCents: 0,
  balanceCents: 0,
  pendingExtraCents: 0,
};
