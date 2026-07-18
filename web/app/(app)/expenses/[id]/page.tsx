import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember, isAdult as isParent, isParent as isRealParent } from "@/lib/auth"; // adults can view family receipts
import { deleteExpense } from "@/lib/actions/expenses";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { categoryInfo } from "@/lib/types";
import { buttonDanger, buttonSecondary, Card } from "@/components/ui";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireMember();
  const { id } = await params;

  const expense = await db.expense.findUnique({
    where: { id },
    include: { member: true },
  });
  if (!expense || expense.familyId !== member.familyId) notFound();
  // Kids can only open their own expenses.
  if (!isParent(member) && expense.memberId !== member.id) notFound();

  const category = categoryInfo(expense.category);

  const canTouch = expense.memberId === member.id || isRealParent(member);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expense</h1>
        {canTouch && (
          <div className="flex gap-2">
            <Link href={`/expenses/${expense.id}/edit`} className={buttonSecondary}>
              Edit
            </Link>
            <form action={deleteExpense.bind(null, expense.id)}>
              <button type="submit" className={buttonDanger}>
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      <Card className="mt-6">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Title</dt>
            <dd className="font-medium">{expense.title}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Amount</dt>
            <dd className="font-bold text-red-600 dark:text-red-400">
              {fmtMoney(expense.amountCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Spent by</dt>
            <dd className="font-medium">
              {expense.member.emoji} {expense.member.name}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Category</dt>
            <dd>
              {category.emoji} {category.label}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-slate-400">Date</dt>
            <dd>{fmtDate(expense.date)}</dd>
          </div>
          {expense.notes && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500 dark:text-slate-400">Notes</dt>
              <dd className="text-right">{expense.notes}</dd>
            </div>
          )}
        </dl>
      </Card>

      <Card className="mt-4">
        <p className="mb-3 text-sm font-semibold">🧾 Bill / receipt</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/receipts/${expense.id}`}
          alt={`Receipt for ${expense.title}`}
          className="w-full rounded-xl"
        />
      </Card>
    </div>
  );
}
