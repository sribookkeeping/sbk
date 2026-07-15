import { notFound } from "next/navigation";
import { requireMember, isParent } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateExpense } from "@/lib/actions/expenses";
import { toDateInput } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;
  const { error } = await searchParams;

  const expense = await db.expense.findUnique({ where: { id }, include: { member: true } });
  if (!expense || expense.familyId !== member.familyId) notFound();
  if (expense.memberId !== member.id && !isParent(member)) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Edit Expense</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Spent by {expense.member.emoji} {expense.member.name}. All edits are recorded in the audit
        log for parent review.
      </p>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={updateExpense.bind(null, expense.id)} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">What was it?</label>
            <input id="title" name="title" required defaultValue={expense.title} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="amount">Amount ($)</label>
              <input
                id="amount"
                name="amount"
                required
                inputMode="decimal"
                defaultValue={(expense.amountCents / 100).toFixed(2)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                defaultValue={toDateInput(expense.date)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={expense.category} className={inputClass}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.emoji} {category.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={2} defaultValue={expense.notes} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="receipt">
              🧾 Replace bill photo (optional)
            </label>
            <input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/*"
              capture="environment"
              className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
            />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>Save Changes</button>
        </form>
      </Card>
    </div>
  );
}
