import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { fmtDate, fmtMoney } from "@/lib/format";
import {
  AssignmentStatus,
  ExtraStatus,
  ReportFrequency,
  reportFrequencyDays,
  roleLabel,
} from "@/lib/types";

// Balance-sheet reports: chores earned, expenses spent, and totals — per
// member and for the whole family — over a period. Emailed on each member's
// chosen cadence (daily/weekly/monthly/quarterly/half-yearly/yearly) and
// viewable any time on the /reports page.

export type ReportLine = {
  date: Date;
  title: string;
  memberName: string;
  amountCents: number;
};

export type MemberSummary = {
  memberId: string;
  name: string;
  emoji: string;
  role: string;
  choresCompleted: number;
  earnedCents: number;
  expenseCount: number;
  spentCents: number;
  paidOutCents: number;
  netCents: number;
  allTimeBalanceCents: number;
};

export type BalanceSheet = {
  familyName: string;
  periodStart: Date;
  periodEnd: Date;
  earnings: ReportLine[];
  expenses: ReportLine[];
  payouts: ReportLine[];
  members: MemberSummary[];
  totalEarnedCents: number;
  totalSpentCents: number;
  totalPaidOutCents: number;
  totalNetCents: number;
};

export async function buildBalanceSheet(
  familyId: string,
  periodStart: Date,
  periodEnd: Date,
  onlyMemberId?: string, // kids get a personal sheet
): Promise<BalanceSheet> {
  const [family, allAssignments, allExpenses, allPayouts] = await Promise.all([
    db.family.findUniqueOrThrow({ where: { id: familyId }, include: { members: true } }),
    db.assignment.findMany({
      where: { chore: { familyId }, status: AssignmentStatus.COMPLETED },
      include: { chore: true, assignee: true },
    }),
    db.expense.findMany({ where: { familyId }, include: { member: true } }),
    db.payout.findMany({ where: { familyId }, include: { member: true } }),
  ]);

  const members = onlyMemberId
    ? family.members.filter((m) => m.id === onlyMemberId)
    : family.members;
  const memberIds = new Set(members.map((m) => m.id));

  const earnedOf = (a: (typeof allAssignments)[number]) =>
    a.baseAmountCents + (a.extraStatus === ExtraStatus.APPROVED ? a.extraAmountCents : 0);

  const inPeriod = (d: Date | null) => d !== null && d >= periodStart && d <= periodEnd;

  const completed = allAssignments.filter(
    (a) => a.assigneeId && memberIds.has(a.assigneeId) && inPeriod(a.completedAt),
  );
  const spent = allExpenses.filter((e) => memberIds.has(e.memberId) && inPeriod(e.date));
  const paid = allPayouts.filter((pay) => memberIds.has(pay.memberId) && inPeriod(pay.createdAt));

  const summaries: MemberSummary[] = members.map((m) => {
    const myChores = completed.filter((a) => a.assigneeId === m.id);
    const myExpenses = spent.filter((e) => e.memberId === m.id);
    const myPayouts = paid.filter((pay) => pay.memberId === m.id);
    const earnedCents = myChores.reduce((sum, a) => sum + earnedOf(a), 0);
    const spentCents = myExpenses.reduce((sum, e) => sum + e.amountCents, 0);
    const paidOutCents = myPayouts.reduce((sum, pay) => sum + pay.amountCents, 0);
    // All-time balance, independent of the report period.
    const allTimeEarned = allAssignments
      .filter((a) => a.assigneeId === m.id)
      .reduce((sum, a) => sum + earnedOf(a), 0);
    const allTimeSpent = allExpenses
      .filter((e) => e.memberId === m.id)
      .reduce((sum, e) => sum + e.amountCents, 0);
    const allTimePaidOut = allPayouts
      .filter((pay) => pay.memberId === m.id)
      .reduce((sum, pay) => sum + pay.amountCents, 0);
    return {
      memberId: m.id,
      name: m.name,
      emoji: m.emoji,
      role: m.role,
      choresCompleted: myChores.length,
      earnedCents,
      expenseCount: myExpenses.length,
      spentCents,
      paidOutCents,
      netCents: earnedCents - spentCents - paidOutCents,
      allTimeBalanceCents: allTimeEarned - allTimeSpent - allTimePaidOut,
    };
  });

  const totalEarnedCents = summaries.reduce((sum, s) => sum + s.earnedCents, 0);
  const totalSpentCents = summaries.reduce((sum, s) => sum + s.spentCents, 0);
  const totalPaidOutCents = summaries.reduce((sum, s) => sum + s.paidOutCents, 0);

  return {
    familyName: family.name,
    periodStart,
    periodEnd,
    earnings: completed
      .map((a) => ({
        date: a.completedAt ?? a.createdAt,
        title: a.chore.title,
        memberName: a.assignee?.name ?? "—",
        amountCents: earnedOf(a),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    expenses: spent
      .map((e) => ({
        date: e.date,
        title: e.title,
        memberName: e.member.name,
        amountCents: e.amountCents,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    payouts: paid
      .map((pay) => ({
        date: pay.createdAt,
        title: pay.note || "Payout",
        memberName: pay.member.name,
        amountCents: pay.amountCents,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    members: summaries,
    totalEarnedCents,
    totalSpentCents,
    totalPaidOutCents,
    totalNetCents: totalEarnedCents - totalSpentCents - totalPaidOutCents,
  };
}

export function renderReportHtml(sheet: BalanceSheet): string {
  const money = (cents: number) => fmtMoney(cents);
  const row = (cells: string[], bold = false) =>
    `<tr>${cells
      .map(
        (c, i) =>
          `<td style="padding:6px 10px;border-bottom:1px solid #eee;${i > 0 ? "text-align:right;" : ""}${bold ? "font-weight:bold;" : ""}">${c}</td>`,
      )
      .join("")}</tr>`;

  const lineTable = (title: string, lines: ReportLine[]) =>
    lines.length === 0
      ? `<p style="color:#777">No ${title.toLowerCase()} this period.</p>`
      : `<table style="border-collapse:collapse;width:100%">${lines
          .map((l) => row([fmtDate(l.date), l.title, l.memberName, money(l.amountCents)]))
          .join("")}</table>`;

  return `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:0 auto;color:#222">
  <h1 style="font-size:20px">🏡 ${sheet.familyName} — Balance Sheet</h1>
  <p style="color:#555">${fmtDate(sheet.periodStart)} – ${fmtDate(sheet.periodEnd)}</p>

  <h2 style="font-size:16px">Summary</h2>
  <table style="border-collapse:collapse;width:100%">
    ${row(["Member", "Chores", "Earned", "Expenses", "Spent", "Paid out", "Net", "All-time balance"], true)}
    ${sheet.members
      .map((m) =>
        row([
          `${m.emoji} ${m.name} (${roleLabel(m.role)})`,
          String(m.choresCompleted),
          money(m.earnedCents),
          String(m.expenseCount),
          money(m.spentCents),
          money(m.paidOutCents),
          money(m.netCents),
          money(m.allTimeBalanceCents),
        ]),
      )
      .join("")}
    ${row(
      [
        "Family total",
        "",
        money(sheet.totalEarnedCents),
        "",
        money(sheet.totalSpentCents),
        money(sheet.totalPaidOutCents),
        money(sheet.totalNetCents),
        "",
      ],
      true,
    )}
  </table>

  <h2 style="font-size:16px">Chore earnings</h2>
  ${lineTable("Chore earnings", sheet.earnings)}

  <h2 style="font-size:16px">Expenses</h2>
  ${lineTable("Expenses", sheet.expenses)}

  <h2 style="font-size:16px">Payouts</h2>
  ${lineTable("Payouts", sheet.payouts)}

  <p style="color:#999;font-size:12px">Sent by SriBookKeeping · manage your report frequency on the Reports page.</p>
</div>`;
}

/**
 * Emails a balance sheet to every member whose cadence says one is due.
 * Locally this runs opportunistically (page loads); in the cloud, wire it to
 * a daily cron so timing is exact. Idempotent via lastReportSentAt.
 */
export async function sendDueReports(familyId: string): Promise<void> {
  const members = await db.member.findMany({
    where: { familyId, email: { not: null } },
  });
  const now = new Date();

  for (const member of members) {
    const days = reportFrequencyDays(member.reportFrequency);
    if (member.reportFrequency === ReportFrequency.NONE || days <= 0) continue;

    const last = member.lastReportSentAt ?? member.createdAt;
    const dueAt = new Date(last.getTime() + days * 24 * 60 * 60 * 1000);
    if (now < dueAt) continue;

    await emailReport(member.id, last, now);
  }
}

/** Builds and emails one report; returns false if the member has no email. */
export async function emailReport(
  memberId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<boolean> {
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId } });
  if (!member.email) return false;

  const sheet = await buildBalanceSheet(
    member.familyId,
    periodStart,
    periodEnd,
    member.role === "CHILD" ? member.id : undefined,
  );
  await sendEmail({
    to: member.email,
    subject: `${sheet.familyName} balance sheet — ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`,
    html: renderReportHtml(sheet),
  });
  await db.member.update({
    where: { id: memberId },
    data: { lastReportSentAt: periodEnd },
  });
  return true;
}
