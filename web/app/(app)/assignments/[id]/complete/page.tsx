import { notFound } from "next/navigation";
import { requireMember, isParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeAssignment } from "@/lib/actions/chores";
import { AssignmentStatus } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass, Money } from "@/components/ui";

export default async function CompleteAssignmentPage({
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
    !assignment.assignee || // unclaimed — must be claimed before completing
    assignment.chore.familyId !== member.familyId ||
    assignment.status !== AssignmentStatus.PENDING ||
    (assignment.assigneeId !== member.id && !isParent(member))
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Complete Chore</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <div className="mb-5 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-950">
          <div>
            <p className="font-semibold">{assignment.chore.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Assigned to {assignment.assignee.name}
            </p>
          </div>
          <Money cents={assignment.baseAmountCents} tone="positive" className="text-lg" />
        </div>

        <form action={completeAssignment.bind(null, assignment.id)} className="space-y-5">
          <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
            <p className="text-sm font-semibold">Was it harder than usual? 💪</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The base amount is credited right away. Any extra you request is credited once a
              parent approves it.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="extraAmount">
                  Extra amount ($, optional)
                </label>
                <input
                  id="extraAmount"
                  name="extraAmount"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="extraReason">
                  Why was it harder today? (required if requesting extra)
                </label>
                <textarea id="extraReason" name="extraReason" rows={2} className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="proof">
              📸 Photo proof of the finished work (required)
            </label>
            <input
              id="proof"
              name="proof"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              On a phone this opens the camera. Parents can see the photo in the audit log.
            </p>
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`}>
            ✓ Mark Complete
          </button>
        </form>
      </Card>
    </div>
  );
}
