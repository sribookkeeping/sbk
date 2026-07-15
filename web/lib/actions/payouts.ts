"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { parseMoney, fmtMoney } from "@/lib/format";
import { notifyFamily } from "@/lib/notifications";
import { NotificationType } from "@/lib/types";

function fail(message: string): never {
  redirect(`/family?error=${encodeURIComponent(message)}`);
}

/**
 * Record a payout: cash (or a transfer) handed to a member. Parents only.
 * balance = earned − spent − paid out, so this settles the ledger.
 */
export async function recordPayout(formData: FormData) {
  const member = await requireMember();
  if (!isParent(member)) fail("Only parents can record payouts.");

  const memberId = String(formData.get("memberId") ?? "");
  const amountCents = parseMoney(String(formData.get("amount") ?? ""));
  const note = String(formData.get("note") ?? "").trim();

  const recipient = member.family.members.find((m) => m.id === memberId);
  if (!recipient) fail("Pick a family member.");
  if (amountCents === null || amountCents <= 0) fail("Enter a valid payout amount.");

  const payout = await db.payout.create({
    data: {
      familyId: member.familyId,
      memberId: recipient.id,
      paidById: member.id,
      amountCents,
      note,
    },
  });

  await audit(member, AuditAction.PAYOUT_RECORDED, "Payout", payout.id, {
    to: recipient.name,
    amountCents,
    note,
  });
  await notifyFamily(
    member.familyId,
    NotificationType.GENERAL,
    "Payout recorded 💵",
    `${member.name} paid ${recipient.name} ${fmtMoney(amountCents)}${note ? ` — ${note}` : ""}.`,
  );

  revalidatePath("/", "layout");
  redirect("/family?paid=1");
}
