import Link from "next/link";
import { requireMember, isAdult } from "@/lib/auth";
import { choreHiddenFrom } from "@/lib/events";
import { db } from "@/lib/db";
import { familyBalances, EMPTY_BALANCE } from "@/lib/ledger";
import { fmtDate, fmtDateTime, fmtMoney, isOverdue } from "@/lib/format";
import { AssignmentStatus } from "@/lib/types";
import { Avatar, Card, EmptyState, Money, SectionTitle } from "@/components/ui";

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
      <h1 className="text-2xl font-bold">Hi, {member.name} 👋</h1>

      <Card className="mt-5 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">My Balance</p>
        <p
          className={`mt-1 text-5xl font-bold tabular-nums ${
            mine.balanceCents < 0 ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {fmtMoney(mine.balanceCents)}
        </p>
        {mine.pendingExtraCents > 0 && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            +{fmtMoney(mine.pendingExtraCents)} extra pay awaiting approval
          </p>
        )}
        <div className="mt-4 flex justify-center gap-8 text-sm">
          <span>
            <span className="text-zinc-500 dark:text-zinc-400">Earned </span>
            <Money cents={mine.earnedCents} tone="positive" />
          </span>
          <span>
            <span className="text-zinc-500 dark:text-zinc-400">Spent </span>
            <Money cents={mine.spentCents} tone={mine.spentCents > 0 ? "negative" : "plain"} />
          </span>
        </div>
      </Card>

      <SectionTitle>My open chores ({openAssignments.length})</SectionTitle>
      <Card>
        {openAssignments.length === 0 && (
          <EmptyState>
            Nothing on your plate —{" "}
            <Link href="/chores" className="font-semibold text-emerald-600 dark:text-emerald-400">
              pick up a chore
            </Link>{" "}
            to start earning!
          </EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {openAssignments.slice(0, 5).map((assignment) => (
            <li key={assignment.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{assignment.chore.title}</p>
                {assignment.dueDate && (
                  <p
                    className={`text-xs ${
                      isOverdue(assignment.dueDate, assignment.status)
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    Due {fmtDateTime(assignment.dueDate)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Money cents={assignment.baseAmountCents} tone="positive" />
                <Link
                  href={`/assignments/${assignment.id}/complete`}
                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Complete
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {parent && (
        <>
          <SectionTitle>Family balances</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {member.family.members.filter((m) => !m.deactivatedAt).map((m) => {
              const b = balances.get(m.id) ?? EMPTY_BALANCE;
              return (
                <Card key={m.id} className="text-center">
                  <Avatar emoji={m.emoji} isParent={m.role === "PARENT"} size={44} />
                  <p className="mt-2 text-sm font-medium">
                    {m.name} {m.isHead && "👑"}
                  </p>
                  <Money cents={b.balanceCents} className="text-lg" />
                </Card>
              );
            })}
          </div>
        </>
      )}

      <SectionTitle>Recent activity</SectionTitle>
      <Card>
        {activity.length === 0 && <EmptyState>No activity yet.</EmptyState>}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {activity.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">{item.isEarning ? "➕" : "➖"}</span>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.subtitle} · {fmtDate(item.date)}
                  </p>
                </div>
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
