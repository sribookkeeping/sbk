import { requireMember, isAdult as isParent } from "@/lib/auth"; // adults can log for anyone
import { createExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;
  const parent = isParent(member);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">New Expense</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={createExpense} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="memberId">Who spent it?</label>
            {parent ? (
              <select id="memberId" name="memberId" defaultValue={member.id} className={inputClass}>
                {member.family.members.filter((m) => !m.deactivatedAt).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.emoji} {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/15">
                {member.emoji} {member.name}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">What was it?</label>
            <input id="title" name="title" required placeholder="School supplies" className={inputClass} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="amount">Amount ($)</label>
              <input id="amount" name="amount" required inputMode="decimal" placeholder="12.50" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="date">Date</label>
              <input id="date" name="date" type="date" defaultValue={today} className={inputClass} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue="OTHER" className={inputClass}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.emoji} {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" rows={2} className={inputClass} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="receipt">
              🧾 Photo of the bill (required)
            </label>
            <input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/*"
              capture="environment"
              required
              className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              On a phone this opens the camera; on a computer, choose an image file.
            </p>
          </div>

          <button type="submit" className={`${buttonPrimary} w-full`}>Save Expense</button>
        </form>
      </Card>
    </div>
  );
}
