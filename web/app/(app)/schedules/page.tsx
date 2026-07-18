import Link from "next/link";
import { requireMember, isParent, parents } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseIds } from "@/lib/approvals";
import { recurrenceDescription } from "@/lib/schedules";
import { deleteSchedule, pauseSchedule, resumeSchedule } from "@/lib/actions/schedules";
import { hourLabel } from "@/lib/format";
import { ScheduleStatus } from "@/lib/types";
import { Badge, buttonPrimary, Card, EmptyState, ErrorBanner } from "@/components/ui";

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  [ScheduleStatus.ACTIVE]: { color: "green", label: "Active" },
  [ScheduleStatus.PENDING_APPROVAL]: { color: "orange", label: "Pending approval" },
  [ScheduleStatus.REJECTED]: { color: "red", label: "Rejected" },
  [ScheduleStatus.PAUSED]: { color: "gray", label: "Paused" },
};

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;
  const parent = isParent(member);
  const familyParents = parents(member);

  const schedules = await db.schedule.findMany({
    where: { familyId: member.familyId },
    include: { chore: true, assignees: { include: { member: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <Link href="/schedules/new" className={buttonPrimary}>
          + New Schedule
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Recurring chores start once <strong>both parents</strong> approve.
      </p>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        {schedules.length === 0 && (
          <EmptyState>No schedules yet — set up a recurring chore.</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {schedules.map((schedule) => {
            const badge = STATUS_BADGE[schedule.status] ?? STATUS_BADGE[ScheduleStatus.PAUSED];
            const approvedIds = parseIds(schedule.approvedByIds);
            const waitingOn = familyParents.filter((p) => !approvedIds.includes(p.id));
            return (
              <li key={schedule.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{schedule.chore.title}</p>
                  <Badge color={badge.color}>{badge.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {recurrenceDescription(schedule)} · remind at {hourLabel(schedule.reminderHour)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {schedule.assignees.length === 0
                    ? "Open to anyone — family is reminded to claim, then it's auto-assigned"
                    : `${schedule.assignees.map((a) => a.member.name).join(", ")}`}
                </p>
                {schedule.status === ScheduleStatus.PENDING_APPROVAL && waitingOn.length > 0 && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Waiting on: {waitingOn.map((p) => p.name).join(", ")}
                  </p>
                )}
                {parent && (
                  <div className="mt-2 flex gap-2">
                    {schedule.status === ScheduleStatus.ACTIVE && (
                      <form action={pauseSchedule.bind(null, schedule.id)}>
                        <button className="text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">
                          Pause
                        </button>
                      </form>
                    )}
                    {schedule.status === ScheduleStatus.PAUSED && (
                      <form action={resumeSchedule.bind(null, schedule.id)}>
                        <button className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                          Resume
                        </button>
                      </form>
                    )}
                    <form action={deleteSchedule.bind(null, schedule.id)}>
                      <button className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400">
                        Delete
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
