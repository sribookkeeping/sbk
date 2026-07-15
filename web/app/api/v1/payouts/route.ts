import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { fmtMoney } from "@/lib/format";
import { notifyFamily } from "@/lib/notifications";
import { NotificationType } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** GET → payouts in the family (kids see their own). */
export const GET = withAuth(async (member) => {
  const payouts = await db.payout.findMany({
    where:
      member.role === "CHILD"
        ? { memberId: member.id }
        : { familyId: member.familyId },
    include: { member: true, paidBy: true },
    orderBy: { createdAt: "desc" },
  });
  return json({
    payouts: payouts.map((p) => ({
      id: p.id,
      memberId: p.memberId,
      memberName: p.member.name,
      paidByName: p.paidBy?.name ?? null,
      amountCents: p.amountCents,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

/** POST { memberId, amountCents, note? } — parents only. */
export const POST = withAuth(async (member, request) => {
  if (member.role !== "PARENT") return apiError("Only parents can record payouts", 403);

  let body: { memberId?: string; amountCents?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const recipient = member.family.members.find((m) => m.id === body.memberId);
  if (!recipient) return apiError("Invalid memberId", 400);
  const amountCents = Math.round(body.amountCents ?? 0);
  if (amountCents <= 0) return apiError("amountCents must be positive", 400);

  const payout = await db.payout.create({
    data: {
      familyId: member.familyId,
      memberId: recipient.id,
      paidById: member.id,
      amountCents,
      note: (body.note ?? "").trim(),
    },
  });
  await audit(member, AuditAction.PAYOUT_RECORDED, "Payout", payout.id, {
    to: recipient.name,
    amountCents,
  });
  await notifyFamily(
    member.familyId,
    NotificationType.GENERAL,
    "Payout recorded 💵",
    `${member.name} paid ${recipient.name} ${fmtMoney(amountCents)}.`,
  );
  return json({ payout: { id: payout.id } }, 201);
});
