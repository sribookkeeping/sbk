import Link from "next/link";
import { requireMember, isAdult } from "@/lib/auth";
import { canDecide, familyRequests, requestHeadline } from "@/lib/approvals";
import { choreHiddenFrom } from "@/lib/events";
import { db } from "@/lib/db";
import { claimAssignment } from "@/lib/actions/chores";
import { familyBalances, EMPTY_BALANCE } from "@/lib/ledger";
import { fmtDate, fmtDateTime, fmtMoney, isOverdue } from "@/lib/format";
import { ApprovalStatus, AssignmentStatus } from "@/lib/types";
import { Avatar, Card, Money, SectionTitle, Tile } from "@/components/ui";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCheckCircle,
  IconListChecks,
  IconZap,
} from "@/components/icons";

export default async function DashboardPage() {
  const member = await requireMember();

  const [balances, myOpen, unclaimed, requests, completedAssignments, expenses] =
    await Promise.all([
      familyBalances(member.familyId),
      db.assignment.findMany({
        where: { assigneeId: member.id, status: AssignmentStatus.PENDING },
        include: { chore: true },
        orderBy: { dueDate: { sort: "asc", nulls: "last" } },
      }),
      db.assignment.findMany({
        where: {
          assigneeId: null,
          status: AssignmentStatus.PENDING,
          chore: { familyId: member.familyId },
        },
        include: { chore: { include: { event: true } } },
        orderBy: { dueDate: { sort: "asc", nulls: "last" } },
        take: 6,
      }),
      familyRequests(member.familyId),
      db.assignment.findMany({
        where: { chore: { familyId: member.familyId }, status: AssignmentStatus.COMPLETED },
        include: { chore: { include: { event: true } }, assignee: true },
        orderBy: { completedAt: "desc" },
        take: 6,
      }),
      db.expense.findMany({
        where: { familyId: member.familyId },
        include: { member: true },
        orderBy: { date: "desc" },
        take: 6,
      }),
    ]);

  const mine = balances.get(member.id) ?? EMPTY_BALANCE;
  const parent = isAdult(member); // adults see family-wide balances & activity

  const claimable = unclaimed.filter((a) => !choreHiddenFrom(a.chore, member.id));
  const needsMe = requests.filter(
    (r) => r.status === ApprovalStatus.PENDING && canDecide(r, member),
  );

  // The single most urgent thing: my next chore, else an approval, else a claim.
  const nextChore = myOpen[0];
  const queueChores = myOpen.slice(nextChore ? 1 : 0, 5);

  const activity = [
    ...completedAssignments
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
    .slice(0, 4);

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: member.family.timezone,
  }).format(new Date());

  const kpi = "rounded-2xl border border-black/8 bg-white p-4 dark:border-white/8 dark:bg-slate-900";
  const kpiLabel =
    "text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase whitespace-nowrap";

  return (
    <>
      {/* KPI strip — one row, scrolls sideways on small screens */}
      <div className="flex gap-3 overflow-x-auto pb-1 [&>*]:min-w-36 [&>*]:flex-1">
        <div className={kpi}>
          <p className={kpiLabel}>My balance</p>
          <p
            className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
              mine.balanceCents < 0 ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {fmtMoney(mine.balanceCents)}
          </p>
        </div>
        <div className={kpi}>
          <p className={kpiLabel}>Earned</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
            {fmtMoney(mine.earnedCents)}
          </p>
        </div>
        <div className={kpi}>
          <p className={kpiLabel}>Spent</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-red-600 tabular-nums dark:text-red-400">
            {fmtMoney(mine.spentCents)}
          </p>
        </div>
        <Link href="/approvals" className={`${kpi} hover:border-indigo-500/40`}>
          <p className={kpiLabel}>To approve</p>
          <p
            className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
              needsMe.length > 0 ? "text-amber-500 dark:text-amber-400" : ""
            }`}
          >
            {needsMe.length}
          </p>
        </Link>
      </div>

      {/* Today feed — one action queue */}
      <SectionTitle>Today · {today}</SectionTitle>

      {nextChore ? (
        <Card className="!border-indigo-500/40">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-indigo-500 uppercase dark:text-indigo-400">
            Next
            {nextChore.dueDate &&
              ` · ${
                isOverdue(nextChore.dueDate, nextChore.status)
                  ? "overdue — was due"
                  : "due"
              } ${fmtDateTime(nextChore.dueDate)}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xl font-bold tracking-tight">{nextChore.chore.title}</p>
            <Link
              href={`/assignments/${nextChore.id}/complete`}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Complete · earn {fmtMoney(nextChore.baseAmountCents)}
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nothing assigned to you right now
            {claimable.length > 0 ? " — grab something from the queue below." : "."}
          </p>
        </Card>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {queueChores.map((assignment) => (
          <Card key={assignment.id} className="flex items-center gap-3 !py-3">
            <Tile tone="indigo" size={36}>
              <IconListChecks className="h-4.5 w-4.5" />
            </Tile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{assignment.chore.title}</p>
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
          </Card>
        ))}

        {needsMe.slice(0, 3).map((request) => (
          <Card key={request.id} className="flex items-center gap-3 !py-3">
            <Tile tone="amber" size={36}>
              <IconCheckCircle className="h-4.5 w-4.5" />
            </Tile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{requestHeadline(request)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {request.requestedBy?.name ?? "Someone"} is waiting on you
              </p>
            </div>
            <Link
              href="/approvals"
              className="rounded-full border border-amber-500/60 px-3.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50"
            >
              Review
            </Link>
          </Card>
        ))}

        {claimable.slice(0, 3).map((assignment) => (
          <Card key={assignment.id} className="flex items-center gap-3 !py-3">
            <Tile tone="emerald" size={36}>
              <IconZap className="h-4.5 w-4.5" />
            </Tile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                Claim &ldquo;{assignment.chore.title}&rdquo;
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {assignment.dueDate
                  ? `Due ${fmtDateTime(assignment.dueDate)} · first to claim earns it`
                  : "No due date · first to claim earns it"}
              </p>
            </div>
            <Money cents={assignment.baseAmountCents} tone="positive" />
            <form action={claimAssignment.bind(null, assignment.id)}>
              <button
                type="submit"
                className="rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                Claim
              </button>
            </form>
          </Card>
        ))}

        {activity.map((item) => (
          <Card key={item.key} className="flex items-center gap-3 !py-3 opacity-80">
            <Tile tone={item.isEarning ? "emerald" : "red"} size={36}>
              {item.isEarning ? (
                <IconArrowUpRight className="h-4.5 w-4.5" />
              ) : (
                <IconArrowDownRight className="h-4.5 w-4.5" />
              )}
            </Tile>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.subtitle} · {fmtDate(item.date)}
              </p>
            </div>
            <Money
              cents={item.isEarning ? item.amountCents : -item.amountCents}
              tone={item.isEarning ? "positive" : "negative"}
            />
          </Card>
        ))}
      </div>

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
    </>
  );
}
