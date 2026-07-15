import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { familyBalances } from "@/lib/ledger";
import { makeFamily, makeChore, makeAssignment } from "./helpers";

describe("ledger: balance = earned − spent − paid out (requirements 11 + payouts)", () => {
  it("computes earnings, expenses, payouts, and pending extras per member", async () => {
    const { family, parents, kids } = await makeFamily();
    const kid = kids[0];
    const chore = await makeChore(family.id, parents[0].id);

    // 2 completed ($5 each), one with an APPROVED $2 extra, one PENDING $3 extra
    await makeAssignment(chore.id, kid.id, {
      status: "COMPLETED",
      extraAmountCents: 200,
      extraStatus: "APPROVED",
    });
    await makeAssignment(chore.id, kid.id, {
      status: "COMPLETED",
      extraAmountCents: 300,
      extraStatus: "PENDING",
    });
    // pending chore — earns nothing yet
    await makeAssignment(chore.id, kid.id, { status: "PENDING" });
    // unclaimed occurrence — no one earns it
    await makeAssignment(chore.id, null, { status: "PENDING" });

    // $4 expense, $6 payout
    await db.expense.create({
      data: {
        familyId: family.id,
        memberId: kid.id,
        title: "Candy",
        amountCents: 400,
        date: new Date(),
        receiptPath: "x.jpg",
      },
    });
    await db.payout.create({
      data: { familyId: family.id, memberId: kid.id, paidById: parents[0].id, amountCents: 600 },
    });

    const balances = await familyBalances(family.id);
    const mine = balances.get(kid.id)!;
    expect(mine.earnedCents).toBe(500 + 200 + 500); // base+extra, base (pending extra not counted)
    expect(mine.pendingExtraCents).toBe(300);
    expect(mine.spentCents).toBe(400);
    expect(mine.paidOutCents).toBe(600);
    expect(mine.balanceCents).toBe(1200 - 400 - 600);

    const parentBalance = balances.get(parents[0].id)!;
    expect(parentBalance.balanceCents).toBe(0);
  });
});
