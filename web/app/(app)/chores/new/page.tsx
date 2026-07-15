import { requireMember, isParent, parents } from "@/lib/auth";
import { createChore } from "@/lib/actions/chores";
import { eventForMember } from "@/lib/events";
import { WEEKDAY_LABELS } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";
import {
  AssigneePicker,
  DueDateInput,
  ReminderSelect,
  defaultDueValue,
} from "@/components/assignment-form-fields";
import { DueModeFields } from "@/components/due-mode-fields";
import { AssignModeFields } from "@/components/assign-mode-fields";

export default async function NewChorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; eventId?: string }>;
}) {
  const member = await requireMember();
  const { error, eventId } = await searchParams;

  // Optional event linkage: chores created for an event are hidden from the
  // event's excluded members and can't join the shared pool.
  const event = eventId ? await eventForMember(eventId, member) : null;
  const visibleMembers = event
    ? member.family.members.filter((m) => !event.excludedIds.split(",").includes(m.id))
    : member.family.members;

  const otherParents = parents(member).filter((p) => p.id !== member.id);
  const poolHint = !isParent(member)
    ? "Your chore will be sent to a parent for approval before it appears in the pool."
    : otherParents.length === 0
      ? "You are the only parent, so the chore is added to the pool immediately."
      : `${otherParents.map((p) => p.name).join(" and ")} must approve before this chore appears in the pool.`;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">New Chore</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={createChore} className="space-y-5">
          {event && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-900 dark:bg-indigo-950">
              <input type="hidden" name="eventId" value={event.id} />
              🎉 This chore is part of <strong>{event.title}</strong>. Excluded members won&apos;t
              see it, and it can&apos;t repeat on a schedule or join the shared pool.
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" name="title" required placeholder="Mow the lawn" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="details">Details (optional)</label>
            <textarea id="details" name="details" rows={2} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="amount">Amount ($)</label>
            <input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              placeholder="5.00"
              className={inputClass}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-3 py-3 dark:border-white/15">
            <input type="checkbox" name="addToPool" className="mt-0.5 size-4 accent-emerald-600" />
            <span>
              <span className="block text-sm font-medium">Add to family chore pool</span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{poolHint}</span>
            </span>
          </label>

          <hr className="border-black/5 dark:border-white/10" />

          <AssignModeFields
            assignFields={
              <>
                <AssigneePicker members={visibleMembers} />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Optional if the chore only goes to the pool. For schedules, these are the fixed
                  assignees for every occurrence.
                </p>
              </>
            }
          />

          <hr className="border-black/5 dark:border-white/10" />

          <DueModeFields
            defaultMode="once"
            onceFields={<DueDateInput defaultValue={defaultDueValue()} required />}
            scheduleFields={
              <div className="space-y-4 rounded-xl border border-dashed border-black/10 p-4 dark:border-white/15">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="recurrence">Repeats</label>
                  <select id="recurrence" name="recurrence" defaultValue="WEEKLY" className={inputClass}>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (pick weekdays)</option>
                    <option value="MONTHLY">Monthly (pick day)</option>
                  </select>
                </div>
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
                    Schedule ends on (optional)
                  </label>
                  <input id="endDate" name="endDate" type="date" className={inputClass} />
                </div>
              </div>
            }
          />

          <ReminderSelect />

          <button type="submit" className={`${buttonPrimary} w-full`}>Save Chore</button>
        </form>
      </Card>
    </div>
  );
}
