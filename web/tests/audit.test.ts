import { describe, expect, it } from "vitest";
import { audit, AuditAction, familyAudit } from "@/lib/audit";
import { makeFamily } from "./helpers";

describe("audit log (requirement: capture every family activity)", () => {
  it("records actor, action, entity, details — and the impersonating admin", async () => {
    const { family, parents } = await makeFamily();

    await audit(
      { id: parents[0].id, name: parents[0].name, familyId: family.id },
      AuditAction.PAYOUT_RECORDED,
      "Payout",
      "payout-1",
      { amountCents: 500 },
    );
    await audit(
      {
        id: parents[1].id,
        name: parents[1].name,
        familyId: family.id,
        impersonatorId: "admin-1",
      },
      AuditAction.EXPENSE_DELETED,
      "Expense",
      "expense-1",
      { title: "Oops" },
    );

    const entries = await familyAudit(family.id);
    expect(entries).toHaveLength(2);
    // newest first
    expect(entries[0].action).toBe(AuditAction.EXPENSE_DELETED);
    expect(entries[0].impersonatorId).toBe("admin-1");
    expect(entries[1].action).toBe(AuditAction.PAYOUT_RECORDED);
    expect(entries[1].impersonatorId).toBeNull();
    expect(JSON.parse(entries[1].details)).toEqual({ amountCents: 500 });
  });
});
