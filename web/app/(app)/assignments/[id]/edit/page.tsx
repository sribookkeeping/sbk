import { notFound } from "next/navigation";
import { requireMember, isParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { editAssignment } from "@/lib/actions/chores";
import { AssignmentStatus } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, Money } from "@/components/ui";
import { DueDateInput, ReminderSelect } from "@/components/assignment-form-fields";

function toLocalInput(date: Date | null): string | undefined {
  if (!date) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditAssignmentPage({
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
    include: { chore: true, assignee: true },
  });
  if (
    !assignment ||
    assignment.chore.familyId !== member.familyId ||
    assignment.status !== AssignmentStatus.PENDING ||
    (assignment.assigneeId !== member.id && !isParent(member))
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Edit Assignment</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <div className="mb-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950">
          <div>
            <p className="font-semibold">{assignment.chore.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {assignment.assignee?.name ?? "Unclaimed"}
            </p>
          </div>
          <Money cents={assignment.baseAmountCents} tone="positive" className="text-lg" />
        </div>

        <form action={editAssignment.bind(null, assignment.id)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <DueDateInput defaultValue={toLocalInput(assignment.dueDate)} />
            <ReminderSelect defaultValue={String(assignment.reminderHour)} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>Save Changes</button>
        </form>
      </Card>
    </div>
  );
}
