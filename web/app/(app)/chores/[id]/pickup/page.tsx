import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { pickupChore } from "@/lib/actions/chores";
import { ChoreKind, PoolStatus } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, Money } from "@/components/ui";
import { AssignmentFormFields, defaultDueValue } from "@/components/assignment-form-fields";

export default async function PickupChorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const { error } = await searchParams;

  const chore = await db.chore.findUnique({ where: { id } });
  if (
    !chore ||
    chore.familyId !== member.familyId ||
    chore.kind !== ChoreKind.POOL ||
    chore.poolStatus !== PoolStatus.ACTIVE
  ) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Pick Up Chore</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <div className="mb-5 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-950">
          <div>
            <p className="font-semibold">{chore.title}</p>
            {chore.details && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{chore.details}</p>
            )}
          </div>
          <Money cents={chore.amountCents} tone="positive" className="text-lg" />
        </div>

        <form action={pickupChore.bind(null, chore.id)} className="space-y-5">
          <AssignmentFormFields
            members={member.family.members.filter((m) => !m.deactivatedAt)}
            defaultSelectedIds={[member.id]}
            defaultDue={defaultDueValue()}
          />
          <button type="submit" className={`${buttonPrimary} w-full`}>Assign Chore</button>
        </form>
      </Card>
    </div>
  );
}
