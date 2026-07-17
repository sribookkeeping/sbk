import { notFound } from "next/navigation";
import { requireMember, isParent, parents } from "@/lib/auth";
import { db } from "@/lib/db";
import { proposeChoreEdit, proposeChoreDelete } from "@/lib/actions/chore-changes";
import { buttonDanger, buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function EditChorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const { error } = await searchParams;

  if (!isParent(member)) notFound();
  const chore = await db.chore.findUnique({ where: { id } });
  if (!chore || chore.familyId !== member.familyId || chore.deletedAt) notFound();

  const otherParents = parents(member).filter((p) => p.id !== member.id);
  const hint =
    otherParents.length === 0
      ? "You are the only parent, so changes apply immediately."
      : `Changes need approval from ${otherParents.map((p) => p.name).join(" and ")} before they apply. Everything is recorded in the audit log.`;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Edit Chore</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={proposeChoreEdit.bind(null, chore.id)} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">Title</label>
            <input id="title" name="title" required defaultValue={chore.title} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="details">Details</label>
            <textarea id="details" name="details" rows={2} defaultValue={chore.details} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="amount">Amount ($)</label>
            <input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              defaultValue={(chore.amountCents / 100).toFixed(2)}
              className={inputClass}
            />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>
            {otherParents.length === 0 ? "Save Changes" : "Propose Changes"}
          </button>
        </form>
      </Card>

      <Card className="mt-4">
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Deleting cancels open assignments and pauses schedules. Completed history and earnings
          are kept. {otherParents.length > 0 && "Needs the other parent's approval."}
        </p>
        <form action={proposeChoreDelete.bind(null, chore.id)} className="mt-3">
          <button type="submit" className={buttonDanger}>
            {otherParents.length === 0 ? "Delete Chore" : "Propose Deletion"}
          </button>
        </form>
      </Card>
    </div>
  );
}
