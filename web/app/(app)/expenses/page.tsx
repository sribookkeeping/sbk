import Link from "next/link";
import { requireMember, isAdult as isAdultMember } from "@/lib/auth";
const isParent = isAdultMember; // adults (parents/guardians/grandparents) see family-wide expenses
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { categoryInfo } from "@/lib/types";
import { buttonPrimary, Card, EmptyState, ErrorBanner, Money } from "@/components/ui";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;
  const parent = isParent(member);

  const expenses = await db.expense.findMany({
    where: parent ? { familyId: member.familyId } : { memberId: member.id },
    include: { member: true },
    orderBy: { date: "desc" },
  });
  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <Link href="/expenses/new" className={buttonPrimary}>
          + Add Expense
        </Link>
      </div>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <div className="flex items-center justify-between border-b border-black/5 pb-3 dark:border-white/10">
          <p className="text-sm font-semibold">{parent ? "Family total" : "My total"}</p>
          <p className="text-lg font-bold text-red-600 tabular-nums dark:text-red-400">
            {fmtMoney(totalCents)}
          </p>
        </div>

        {expenses.length === 0 && (
          <EmptyState>No expenses yet. Record one with a photo of the bill.</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {expenses.map((expense) => {
            const category = categoryInfo(expense.category);
            return (
              <li key={expense.id}>
                <Link
                  href={`/expenses/${expense.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-black/2 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{category.emoji}</span>
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {expense.member.name} · {fmtDate(expense.date)} · 🧾 receipt attached
                      </p>
                    </div>
                  </div>
                  <Money cents={-expense.amountCents} tone="negative" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
