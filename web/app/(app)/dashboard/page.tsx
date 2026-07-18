import Link from "next/link";
import { requireMember, isAdult } from "@/lib/auth";
import { choreHiddenFrom } from "@/lib/events";
import { db } from "@/lib/db";
import { familyBalances, EMPTY_BALANCE } from "@/lib/ledger";
import { fmtDate, fmtDateTime, fmtMoney, isOverdue } from "@/lib/format";
import { AssignmentStatus } from "@/lib/types";
import { Avatar, Card, EmptyState, Money, SectionTitle, Tile } from "@/components/ui";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconListChecks,
} from "@/components/icons";

export default async function DashboardPage() {
  const member = await requireMember();

  const [balances, openAssignments, completedAssignments, expenses] = await Promise.all([
    familyBalances(member.familyId),
    db.assignment.findMany({
      where: { assigneeId: member.id, status: AssignmentStatus.PENDING },
      include: { chore: true },
      orderBy: { dueDate: "asc" },
    }),
    db.assignment.findMany({
      where: { chore: { familyId: member.familyId }, status: AssignmentStatus.COMPLETED },
      include: { chore: { include: { event: true } }, assignee: true },
      orderBy: { completedAt: "desc" },
      take: 10,
    }),
    db.expense.findMany({
      where: { familyId: member.familyId },
      include: { member: true },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const mine = balances.get(member.id) ?? EMPTY_BALANCE;
  const parent = isAdult(member); // adults see family-wide balances & activity

  type Activity = {
    key: string;
    date: Date;
    title: string;
    subtitle: string;
    amountCents: number;
    isEarning: boolean;
  };
  const activity: Activity[] = [
    ...completedAssignments
      // hide completions of surprise-event chores from excluded members
      .filter((a) => !choreHiddenFrom(a.chore, member.id))
      .filter((a) => a.assignee && (parent || a.assigneeId === member.id))
      .map((a) => ({
        key: `a-${a.id}`,
        date: a.completedAt ?? a.createdAt,
        title: a.chore.title,
        subtitle: `${a.assignee!.name} · completed`,
        amountCents:
          a.baseAmountCents + (a.extraStatus === "APPROVED" ? a.extraAmountCents : 0),
        isEarning: true,
      })),
    ...expenses
      .filter((e) => parent || e.memberId === member.id)
      .map((e) => ({
        key: `e-${e.id}`,
        date: e.date,
        title: e.title,
        subtitle: `${e.member.name} · expense`,
        amountCents: e.amountCents,
        isEarning: false,
      })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  return (
    <>
      {/* Balance hero */}
      <Card className="!p-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
          My balance
        </p>
        <p
          className={`mt-1.5 text-5xl font-bold tracking-tight tabular-nums ${
            mine.balanceCents < 0 ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {fmtMoney(mine.balanceCents)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-600 dark:text-emerald-400">
            <IconArrowUpRight className="h-3.5 w-3.5" />
            Earned {fmtMoney(mine.earnedCents)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1.5 text-red-600 dark:text-red-400">
            <IconArrowDownRight className="h-3.5 w-3.5" />
            Spent {fmtMoney(mine.spentCents)}
          </span>
          {mine.pendingExtraCents > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-amber-600 dark:text-amber-400">
              {fmtMoney(mine.pendingExtraCents)} extra pending
            </span>
          )}
        </div>
      </Card>

      <SectionTitle>My open chores ({openAssignments.length})</SectionTitle>
      <Card>
        {openAssignments.length === 0 && (
          <EmptyState>
            Nothing on your plate —{" "}
            <Link href="/chores" className="font-semibold text-indigo-600 dark:text-indigo-400">
              pick up a chore
            </Link>{" "}
            to start earning.
          </EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {openAssignments.slice(0, 5).map((assignment) => (
            <li key={assignment.id} className="flex items-center gap-3 py-3">
              <Tile tone="indigo">
                <IconListChecks className="h-5 w-5" />
              </Tile>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{assignment.chore.title}</p>
                {assignment.dueDate && (
                  <p
                    className={`text-xs ${
                      isOverdue(assignment.dueDate, assignment.status)
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    Due {fmtDateTime(assignment.dueDate)}
                  </p>
                )}
              </div>
              <Money cents={assignment.baseAmountCents} tone="positive" />
              <Link
                href={`/assignments/${assignment.id}/complete`}
                className="rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Complete
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {parent && (
        <>
          <SectionTitle>Family balances</SectionTitle>
          <Card className="!py-2">
            <ul className="divide-y divide-black/5 dark:divide-white/5">
              {member.family.members
                .filter((m) => !m.deactivatedAt)
                .map((m) => {
                  const b = balances.get(m.id) ?? EMPTY_BALANCE;
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <Avatar emoji={m.emoji} isParent={m.role === "PARENT"} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.name}
                          {m.isHead && (
                            <span className="ml-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                              Head
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 capitalize dark:text-slate-400">
                          {m.role.toLowerCase()}
                        </p>
                      </div>
                      <Money cents={b.balanceCents} className="text-base" />
                    </li>
                  );
                })}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>Recent activity</SectionTitle>
      <Card>
        {activity.length === 0 && <EmptyState>No activity yet.</EmptyState>}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {activity.map((item) => (
            <li key={item.key} className="flex items-center gap-3 py-3">
              <Tile tone={item.isEarning ? "emerald" : "red"}>
                {item.isEarning ? (
                  <IconArrowUpRight className="h-5 w-5" />
                ) : (
                  <IconArrowDownRight className="h-5 w-5" />
                )}
              </Tile>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.subtitle} · {fmtDate(item.date)}
                </p>
              </div>
              <Money
                cents={item.isEarning ? item.amountCents : -item.amountCents}
                tone={item.isEarning ? "positive" : "negative"}
              />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
