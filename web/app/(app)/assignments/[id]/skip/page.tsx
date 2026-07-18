import { notFound } from "next/navigation";
import { requireMember, isParent, parents } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestSkip } from "@/lib/actions/chores";
import { fmtDateTime } from "@/lib/format";
import { AssignmentStatus } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function SkipAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const { error } = await searchParams;

  const assignment = await db.assignment.findUnique({
    where: { id },
    include: { chore: true },
  });
  if (
    !assignment ||
    assignment.chore.familyId !== member.familyId ||
    assignment.status !== AssignmentStatus.PENDING ||
    (assignment.assigneeId !== member.id && !isParent(member))
  ) {
    notFound();
  }

  const otherParents = parents(member).filter((p) => p.id !== member.id);
  const hint =
    isParent(member) && otherParents.length === 0
      ? "You are the only parent, so this applies immediately."
      : "A parent must accept your request.";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Skip or Reschedule</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        &quot;{assignment.chore.title}&quot;
        {assignment.dueDate && ` — due ${fmtDateTime(assignment.dueDate)}`}. {hint}
      </p>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={requestSkip.bind(null, assignment.id)} className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">What do you need?</legend>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-3 has-checked:border-indigo-500 has-checked:bg-indigo-50 dark:border-white/15 dark:has-checked:bg-indigo-950">
              <input type="radio" name="mode" value="skip" defaultChecked className="size-4 accent-indigo-600" />
              <span className="text-sm font-medium">Skip this one entirely</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-3 has-checked:border-indigo-500 has-checked:bg-indigo-50 dark:border-white/15 dark:has-checked:bg-indigo-950">
              <input type="radio" name="mode" value="reschedule" className="size-4 accent-indigo-600" />
              <span className="text-sm font-medium">📆 Move it to a new date</span>
            </label>
          </fieldset>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="newDueDate">
              New due date (for reschedule)
            </label>
            <input id="newDueDate" name="newDueDate" type="datetime-local" className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="reason">
              Why? (required)
            </label>
            <textarea id="reason" name="reason" rows={2} required className={inputClass} />
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`}>Submit Request</button>
        </form>
      </Card>
    </div>
  );
}
