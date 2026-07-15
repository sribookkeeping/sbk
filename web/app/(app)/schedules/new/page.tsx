import Link from "next/link";
import { requireMember, isParent, parents } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSchedule } from "@/lib/actions/schedules";
import { fmtMoney, hourLabel } from "@/lib/format";
import { ChoreKind, PoolStatus, WEEKDAY_LABELS } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";
import { AssigneePicker } from "@/components/assignment-form-fields";
import { AssignModeFields } from "@/components/assign-mode-fields";

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;

  const poolChores = await db.chore.findMany({
    where: { familyId: member.familyId, kind: ChoreKind.POOL, poolStatus: PoolStatus.ACTIVE },
    orderBy: { title: "asc" },
  });

  const otherParents = parents(member).filter((p) => p.id !== member.id);
  const approvalHint = !isParent(member)
    ? "Both parents must approve before the schedule starts."
    : otherParents.length === 0
      ? "You are the only parent, so this schedule starts immediately."
      : `Your approval is recorded; it starts once ${otherParents.map((p) => p.name).join(" and ")} also approves.`;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">New Schedule</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      {poolChores.length === 0 ? (
        <Card className="mt-2 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            There are no active pool chores to schedule yet.
          </p>
          <Link
            href="/chores/new"
            className="mt-2 inline-block font-semibold text-emerald-600 dark:text-emerald-400"
          >
            Add a chore to the pool first →
          </Link>
        </Card>
      ) : (
        <Card className="mt-2">
          <form action={createSchedule} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="choreId">Chore</label>
              <select id="choreId" name="choreId" required className={inputClass}>
                {poolChores.map((chore) => (
                  <option key={chore.id} value={chore.id}>
                    {chore.title} — {fmtMoney(chore.amountCents)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="recurrence">Repeats</label>
              <select id="recurrence" name="recurrence" defaultValue="WEEKLY" className={inputClass}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly (pick weekdays below)</option>
                <option value="MONTHLY">Monthly (pick day below)</option>
              </select>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Weekdays (weekly only)</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, index) => (
                  <label
                    key={label}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-sm has-checked:border-emerald-500 has-checked:bg-emerald-50 dark:border-white/15 dark:has-checked:bg-emerald-950"
                  >
                    <input
                      type="checkbox"
                      name="weekdays"
                      value={index + 1}
                      className="size-3.5 accent-emerald-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="dayOfMonth">
                  Day of month (monthly only)
                </label>
                <input
                  id="dayOfMonth"
                  name="dayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={1}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="endDate">
                  Ends on (optional)
                </label>
                <input id="endDate" name="endDate" type="date" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="reminderHour">
                  Remind at
                </label>
                <select id="reminderHour" name="reminderHour" defaultValue="18" className={inputClass}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <AssignModeFields
              assignFields={
                <AssigneePicker members={member.family.members.filter((m) => !m.deactivatedAt)} />
              }
            />

            <p className="text-xs text-zinc-500 dark:text-zinc-400">{approvalHint}</p>

            <button type="submit" className={`${buttonPrimary} w-full`}>Submit Schedule</button>
          </form>
        </Card>
      )}
    </div>
  );
}
