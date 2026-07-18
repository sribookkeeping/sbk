import Link from "next/link";
import { requireMember, isAdult as isAdultMember } from "@/lib/auth";
const isParent = isAdultMember; // adults (parents/guardians/grandparents) see family-wide expenses
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { categoryInfo } from "@/lib/types";
import {
  buttonPrimary,
  Card,
  EmptyState,
  ErrorBanner,
  Money,
  PageHeader,
  SectionTitle,
  Tile,
} from "@/components/ui";
import { IconChevronRight } from "@/components/icons";

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
      <PageHeader
        title="Expenses"
        action={
          <Link href="/expenses/new" className={buttonPrimary}>
            Add expense
          </Link>
        }
      />
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2 !p-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
          {parent ? "Family total" : "My total"}
        </p>
        <p className="mt-1.5 text-4xl font-bold tracking-tight text-red-600 tabular-nums dark:text-red-400">
          {fmtMoney(totalCents)}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {expenses.length} expense{expenses.length === 1 ? "" : "s"}, receipts attached
        </p>
      </Card>

      <SectionTitle>All expenses</SectionTitle>
      <Card>
        {expenses.length === 0 && (
          <EmptyState>No expenses yet. Record one with a photo of the bill.</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {expenses.map((expense) => {
            const category = categoryInfo(expense.category);
            return (
              <li key={expense.id}>
                <Link
                  href={`/expenses/${expense.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-black/2 dark:hover:bg-white/2"
                >
                  <Tile>{category.emoji}</Tile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{expense.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {expense.member.name} · {fmtDate(expense.date)} · {category.label}
                    </p>
                  </div>
                  <Money cents={-expense.amountCents} tone="negative" />
                  <IconChevronRight className="h-4 w-4 shrink-0 text-slate-600" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
