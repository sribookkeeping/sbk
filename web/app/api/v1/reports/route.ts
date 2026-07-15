import { audit, AuditAction } from "@/lib/audit";
import { buildBalanceSheet } from "@/lib/reports";
import { db } from "@/lib/db";
import { ReportFrequency, Role } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** GET ?days=30 → balance sheet for the period (kids: personal; adults: family). */
export const GET = withAuth(async (member, request) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1), 3650);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const sheet = await buildBalanceSheet(
    member.familyId,
    start,
    end,
    member.role === Role.CHILD ? member.id : undefined,
  );
  return json({
    periodStart: sheet.periodStart.toISOString(),
    periodEnd: sheet.periodEnd.toISOString(),
    members: sheet.members,
    totals: {
      earnedCents: sheet.totalEarnedCents,
      spentCents: sheet.totalSpentCents,
      netCents: sheet.totalNetCents,
    },
    earnings: sheet.earnings.map((l) => ({ ...l, date: l.date.toISOString() })),
    expenses: sheet.expenses.map((l) => ({ ...l, date: l.date.toISOString() })),
    reportFrequency: member.reportFrequency,
  });
});

/** POST { frequency } → set the caller's email-report cadence. */
export const POST = withAuth(async (member, request) => {
  let body: { frequency?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }
  const frequency = body.frequency ?? "";
  if (!Object.values(ReportFrequency).includes(frequency as ReportFrequency)) {
    return apiError(
      `frequency must be one of ${Object.values(ReportFrequency).join(", ")}`,
      400,
    );
  }
  await db.member.update({ where: { id: member.id }, data: { reportFrequency: frequency } });
  await audit(member, AuditAction.REPORT_FREQUENCY_CHANGED, "Member", member.id, { frequency });
  return json({ reportFrequency: frequency });
});
