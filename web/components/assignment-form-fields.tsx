import { Avatar, inputClass } from "@/components/ui";
import { hourLabel } from "@/lib/format";

type MemberOption = { id: string; name: string; emoji: string; role: string };

/** Assignee checkboxes — used by the chore forms. */
export function AssigneePicker({
  members,
  defaultSelectedIds = [],
}: {
  members: MemberOption[];
  defaultSelectedIds?: string[];
}) {
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <label
          key={m.id}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50 dark:border-white/15 dark:has-checked:bg-indigo-950"
        >
          <input
            type="checkbox"
            name="assignees"
            value={m.id}
            defaultChecked={defaultSelectedIds.includes(m.id)}
            className="size-4 accent-indigo-600"
          />
          <Avatar emoji={m.emoji} isParent={m.role === "PARENT"} size={28} />
          <span className="text-sm font-medium">{m.name}</span>
        </label>
      ))}
    </div>
  );
}

export function DueDateInput({
  defaultValue,
  required = false,
}: {
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor="dueDate">
        Due
      </label>
      <input
        id="dueDate"
        name="dueDate"
        type="datetime-local"
        defaultValue={defaultValue}
        required={required}
        className={inputClass}
      />
    </div>
  );
}

export function ReminderSelect({ defaultValue = "18" }: { defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor="reminderHour">
        Daily reminder until done
      </label>
      <select id="reminderHour" name="reminderHour" defaultValue={defaultValue} className={inputClass}>
        <option value="-1">No reminder</option>
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Assignees + due date + reminder — used by the pickup form. */
export function AssignmentFormFields({
  members,
  defaultSelectedIds = [],
  defaultDue,
}: {
  members: MemberOption[];
  defaultSelectedIds?: string[];
  defaultDue?: string;
}) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who&apos;s doing it?</legend>
        <AssigneePicker members={members} defaultSelectedIds={defaultSelectedIds} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <DueDateInput defaultValue={defaultDue} />
        <ReminderSelect />
      </div>
    </>
  );
}

/** Default due date value for datetime-local inputs: today at 6 PM local. */
export function defaultDueValue(): string {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
