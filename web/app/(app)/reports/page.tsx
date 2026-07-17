import { requireMember } from "@/lib/auth";
import { buildBalanceSheet } from "@/lib/reports";
import { setReportFrequency, sendReportNow } from "@/lib/actions/reports";
import { fmtDate, fmtMoney } from "@/lib/format";
import { REPORT_FREQUENCY_OPTIONS, Role, roleLabel } from "@/lib/types";
import {
  buttonPrimary,
  buttonSecondary,
  Card,
  EmptyState,
  ErrorBanner,
  inputClass,
  Money,
  SectionTitle,
} from "@/components/ui";

const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "7", label: "Last 7 days" },
  { value: "90", label: "Last 3 months" },
  { value: "182", label: "Last 6 months" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; error?: string; sent?: string }>;
}) {
  const member = await requireMember();
  const { period = "30", error, sent } = await searchParams;

  const now = new Date();
  const start =
    period === "all"
      ? new Date(2000, 0, 1)
      : new Date(now.getTime() - (parseInt(period, 10) || 30) * 24 * 60 * 60 * 1000);

  // Kids see their own sheet; adults see the whole family's.
  const sheet = await buildBalanceSheet(
    member.familyId,
    start,
    now,
    member.role === Role.CHILD ? member.id : undefined,
  );

  return (
    <>
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
        {sent === "now" && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            Report emailed to {member.email}. (Locally, emails land in{" "}
            <code>web/outbox/</code>.)
          </div>
        )}
        {sent === "pref" && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            Report schedule updated.
          </div>
        )}
      </div>

      <Card>
        <p className="text-sm font-semibold">📬 Email reports</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {member.email
            ? `Balance sheets go to ${member.email} on the schedule you pick.`
            : "Add an email to your profile to receive reports."}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <form action={setReportFrequency} className="flex items-end gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="frequency">
                Frequency
              </label>
              <select
                id="frequency"
                name="frequency"
                defaultValue={member.reportFrequency}
                className={inputClass}
              >
                {REPORT_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonSecondary}>
              Save
            </button>
          </form>
          <form action={sendReportNow}>
            <button type="submit" className={buttonPrimary} disabled={!member.email}>
              Send me a copy now
            </button>
          </form>
        </div>
      </Card>

      <SectionTitle>Balance sheet</SectionTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <a
            key={p.value}
            href={`/reports?period=${p.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              period === p.value
                ? "bg-indigo-600 text-white"
                : "border border-black/10 text-slate-600 hover:bg-black/5 dark:border-white/15 dark:text-slate-300"
            }`}
          >
            {p.label}
          </a>
        ))}
      </div>

      <Card>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          {fmtDate(sheet.periodStart)} – {fmtDate(sheet.periodEnd)}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs text-slate-500 uppercase dark:border-white/15 dark:text-slate-400">
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3 text-right">Chores</th>
                <th className="py-2 pr-3 text-right">Earned</th>
                <th className="py-2 pr-3 text-right">Expenses</th>
                <th className="py-2 pr-3 text-right">Spent</th>
                <th className="py-2 pr-3 text-right">Paid out</th>
                <th className="py-2 pr-3 text-right">Net</th>
                <th className="py-2 text-right">All-time</th>
              </tr>
            </thead>
            <tbody>
              {sheet.members.map((m) => (
                <tr key={m.memberId} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2 pr-3">
                    {m.emoji} {m.name}{" "}
                    <span className="text-xs text-slate-400">({roleLabel(m.role)})</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.choresCompleted}</td>
                  <td className="py-2 pr-3 text-right">
                    <Money cents={m.earnedCents} tone="positive" />
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{m.expenseCount}</td>
                  <td className="py-2 pr-3 text-right">
                    <Money cents={m.spentCents} tone={m.spentCents > 0 ? "negative" : "plain"} />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Money cents={m.paidOutCents} tone="plain" />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Money cents={m.netCents} />
                  </td>
                  <td className="py-2 text-right">
                    <Money cents={m.allTimeBalanceCents} />
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-3">Family total</td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-right">
                  <Money cents={sheet.totalEarnedCents} tone="positive" />
                </td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-right">
                  <Money
                    cents={sheet.totalSpentCents}
                    tone={sheet.totalSpentCents > 0 ? "negative" : "plain"}
                  />
                </td>
                <td className="py-2 pr-3 text-right">
                  <Money cents={sheet.totalPaidOutCents} tone="plain" />
                </td>
                <td className="py-2 pr-3 text-right">
                  <Money cents={sheet.totalNetCents} />
                </td>
                <td className="py-2" />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <SectionTitle>Chore earnings ({sheet.earnings.length})</SectionTitle>
      <Card>
        {sheet.earnings.length === 0 && <EmptyState>No chores completed this period.</EmptyState>}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {sheet.earnings.map((line, index) => (
            <li key={index} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {line.title}{" "}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  · {line.memberName} · {fmtDate(line.date)}
                </span>
              </span>
              <Money cents={line.amountCents} tone="positive" />
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>Expenses ({sheet.expenses.length})</SectionTitle>
      <Card>
        {sheet.expenses.length === 0 && <EmptyState>No expenses this period.</EmptyState>}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {sheet.expenses.map((line, index) => (
            <li key={index} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                {line.title}{" "}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  · {line.memberName} · {fmtDate(line.date)}
                </span>
              </span>
              <Money cents={-line.amountCents} tone="negative" />
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-black/10 pt-3 text-right text-sm font-semibold dark:border-white/15">
          Family total: {fmtMoney(sheet.totalEarnedCents - sheet.totalSpentCents)} net
        </p>
      </Card>
    </>
  );
}
