import Link from "next/link";
import { requireMember, isParent, isAdult } from "@/lib/auth";
import { choreHiddenFrom } from "@/lib/events";
import { db } from "@/lib/db";
import { claimAssignment, giveUpAssignment, retireChore } from "@/lib/actions/chores";
import { fmtDateTime, isOverdue } from "@/lib/format";
import { AssignmentStatus, ChoreKind, PoolStatus } from "@/lib/types";
import {
  Avatar,
  Badge,
  buttonPrimary,
  buttonSecondary,
  Card,
  EmptyState,
  ErrorBanner,
  Money,
  PageHeader,
  SectionTitle,
  Tile,
} from "@/components/ui";
import { IconDots, IconListChecks, IconPencil, IconX, IconZap } from "@/components/icons";

export default async function ChoresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;
  const parent = isParent(member);
  const adult = isAdult(member);

  const [chores, assignments] = await Promise.all([
    db.chore.findMany({
      where: { familyId: member.familyId },
      include: { createdBy: true, event: true },
      orderBy: { createdAt: "desc" },
    }),
    db.assignment.findMany({
      where: { chore: { familyId: member.familyId }, status: AssignmentStatus.PENDING },
      include: { chore: { include: { event: true } }, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
  ]).then(([allChores, allAssignments]) =>
    // Surprise-event chores are invisible to excluded members.
    [
      allChores.filter((c) => !choreHiddenFrom(c, member.id)),
      allAssignments.filter((a) => !choreHiddenFrom(a.chore, member.id)),
    ] as [typeof allChores, typeof allAssignments],
  );

  const upForGrabs = assignments.filter((a) => a.assigneeId === null);
  const myAssignments = assignments.filter((a) => a.assigneeId === member.id);
  const othersAssignments = adult
    ? assignments.filter((a) => a.assigneeId && a.assigneeId !== member.id)
    : assignments.filter(
        (a) => a.assigneeId && a.assigneeId !== member.id && a.autoAssigned,
      );
  const available = chores.filter(
    (c) => c.kind === ChoreKind.POOL && c.poolStatus === PoolStatus.ACTIVE && !c.deletedAt,
  );
  const awaiting = chores.filter(
    (c) =>
      c.kind === ChoreKind.POOL &&
      c.poolStatus === PoolStatus.PENDING_APPROVAL &&
      !c.deletedAt &&
      (adult || c.createdById === member.id),
  );

  return (
    <>
      <PageHeader
        title="Chores"
        action={
          <Link href="/chores/new" className={buttonPrimary}>
            New chore
          </Link>
        }
      />
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      {upForGrabs.length > 0 && (
        <>
          <SectionTitle>Up for grabs — first to claim earns it</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/5">
              {upForGrabs.map((assignment) => (
                <li key={assignment.id} className="flex items-center gap-3 py-3">
                  <Tile tone="amber">
                    <IconZap className="h-5 w-5" />
                  </Tile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{assignment.chore.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {assignment.dueDate
                        ? `Due ${fmtDateTime(assignment.dueDate)} · unclaimed`
                        : "No due date · unclaimed"}
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
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>My chores</SectionTitle>
      <Card>
        {myAssignments.length === 0 && (
          <EmptyState>No open chores — pick one up below.</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {myAssignments.map((assignment) => (
            <li key={assignment.id} className="flex items-center gap-3 py-3">
              <Tile tone="indigo">
                <IconListChecks className="h-5 w-5" />
              </Tile>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {assignment.chore.title}
                  {assignment.autoAssigned && (
                    <span className="ml-2 align-middle">
                      <Badge color="indigo">auto-assigned</Badge>
                    </span>
                  )}
                </p>
                {assignment.dueDate && (
                  <p
                    className={`text-xs ${
                      isOverdue(assignment.dueDate, assignment.status)
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {isOverdue(assignment.dueDate, assignment.status) ? "Overdue — was due " : "Due "}
                    {fmtDateTime(assignment.dueDate)}
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
              <details className="relative">
                <summary className="flex cursor-pointer list-none items-center rounded-full border border-black/10 p-1.5 text-slate-500 hover:bg-black/5 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5">
                  <IconDots className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-10 mt-1 flex w-44 flex-col rounded-xl border border-black/10 bg-white p-1 text-sm shadow-lg dark:border-white/10 dark:bg-slate-900">
                  <Link
                    href={`/assignments/${assignment.id}/edit`}
                    className="rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Edit due / reminder
                  </Link>
                  <Link
                    href={`/assignments/${assignment.id}/skip`}
                    className="rounded-lg px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Skip / reschedule
                  </Link>
                  <form action={giveUpAssignment.bind(null, assignment.id)}>
                    <button className="w-full rounded-lg px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                      Give it up
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>Available chores</SectionTitle>
      <Card>
        {available.length === 0 && (
          <EmptyState>
            The chore pool is empty. Parents (or anyone, with approval) can add chores.
          </EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {available.map((chore) => (
            <li key={chore.id} className="flex items-center gap-3 py-3">
              <Tile>
                <IconListChecks className="h-5 w-5" />
              </Tile>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{chore.title}</p>
                {chore.details && (
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {chore.details}
                  </p>
                )}
              </div>
              <Money cents={chore.amountCents} tone="positive" />
              <Link
                href={`/chores/${chore.id}/pickup`}
                className="rounded-full border border-indigo-500/50 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
              >
                Pick up
              </Link>
              {parent && (
                <span className="flex items-center">
                  <Link
                    href={`/chores/${chore.id}/edit`}
                    title="Edit (needs both parents)"
                    className="rounded-full p-1.5 text-slate-500 hover:text-indigo-400"
                  >
                    <IconPencil className="h-4 w-4" />
                  </Link>
                  <form action={retireChore.bind(null, chore.id)}>
                    <button
                      type="submit"
                      title="Retire from pool"
                      className="rounded-full p-1.5 text-slate-500 hover:text-red-400"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </form>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {awaiting.length > 0 && (
        <>
          <SectionTitle>Waiting for approval</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/5">
              {awaiting.map((chore) => (
                <li key={chore.id} className="flex items-center gap-3 py-3">
                  <Tile>
                    <IconListChecks className="h-5 w-5" />
                  </Tile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{chore.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Proposed by {chore.createdBy?.name ?? "someone"}
                    </p>
                  </div>
                  <Money cents={chore.amountCents} tone="plain" />
                  <Badge color="orange">Pending</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {othersAssignments.length > 0 && (
        <>
          <SectionTitle>Family chores in progress</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/5">
              {othersAssignments.map((assignment) => (
                <li key={assignment.id} className="flex items-center gap-3 py-3">
                  {assignment.assignee && (
                    <Avatar
                      emoji={assignment.assignee.emoji}
                      isParent={assignment.assignee.role === "PARENT"}
                      size={40}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {assignment.chore.title}
                      {assignment.autoAssigned && (
                        <span className="ml-2 align-middle">
                          <Badge color="indigo">auto-assigned</Badge>
                        </span>
                      )}
                    </p>
                    <p
                      className={`text-xs ${
                        isOverdue(assignment.dueDate, assignment.status)
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {assignment.assignee?.name}
                      {assignment.dueDate && ` · due ${fmtDateTime(assignment.dueDate)}`}
                    </p>
                  </div>
                  <Money cents={assignment.baseAmountCents} tone="plain" />
                  {assignment.autoAssigned && (
                    <form action={claimAssignment.bind(null, assignment.id)}>
                      <button
                        type="submit"
                        className="rounded-full border border-amber-500/60 px-3.5 py-1.5 text-xs font-semibold text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/50"
                      >
                        Take over
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/schedules" className={buttonSecondary}>
          Recurring schedules
        </Link>
      </div>
    </>
  );
}
