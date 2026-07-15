"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isAdult as isParent, isParent as isRealParent } from "@/lib/auth"; // adults can log for anyone
import { audit, AuditAction } from "@/lib/audit";
import { parseDateInput, parseMoney } from "@/lib/format";
import { saveReceipt } from "@/lib/storage";
import { EXPENSE_CATEGORIES } from "@/lib/types";

function fail(message: string): never {
  redirect(`/expenses/new?error=${encodeURIComponent(message)}`);
}

/** Requirements 10 & 12: record an expense with a required photo of the bill. */
export async function createExpense(formData: FormData) {
  const member = await requireMember();

  const title = String(formData.get("title") ?? "").trim();
  const amountCents = parseMoney(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("date") ?? "");
  const category = String(formData.get("category") ?? "OTHER");
  const notes = String(formData.get("notes") ?? "").trim();
  const receipt = formData.get("receipt");

  // Parents may record an expense for anyone; kids only for themselves.
  const requestedMemberId = String(formData.get("memberId") ?? member.id);
  const payer = isParent(member)
    ? member.family.members.find((m) => m.id === requestedMemberId)
    : member;
  if (!payer) fail("Pick a family member.");

  if (!title) fail("What was the expense for?");
  if (amountCents === null || amountCents <= 0) fail("Enter a valid dollar amount.");
  if (!EXPENSE_CATEGORIES.some((c) => c.value === category)) fail("Pick a category.");
  if (!(receipt instanceof File) || receipt.size === 0) {
    fail("A photo of the bill is required.");
  }

  let receiptPath: string;
  try {
    receiptPath = await saveReceipt(receipt);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Could not save the receipt photo.");
  }

  const expense = await db.expense.create({
    data: {
      familyId: member.familyId,
      memberId: payer.id,
      title,
      amountCents,
      date: dateRaw ? (parseDateInput(dateRaw) ?? new Date()) : new Date(),
      category,
      notes,
      receiptPath,
    },
  });

  await audit(member, AuditAction.EXPENSE_CREATED, "Expense", expense.id, {
    title,
    amountCents,
    for: payer.name,
  });
  revalidatePath("/", "layout");
  redirect("/expenses");
}

function canTouchExpense(
  member: { id: string; role: string },
  expense: { memberId: string },
): boolean {
  // The owner, or a real parent, can edit/delete (all changes audited).
  return expense.memberId === member.id || isRealParent(member);
}

/** Edit an expense (owner or parent). Receipt photo is optionally replaced. */
export async function updateExpense(expenseId: string, formData: FormData) {
  const member = await requireMember();
  const backPath = `/expenses/${expenseId}/edit`;

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.familyId !== member.familyId) fail("Expense not found.");
  if (!canTouchExpense(member, expense)) fail("Only the owner or a parent can edit this.");

  const title = String(formData.get("title") ?? "").trim();
  const amountCents = parseMoney(String(formData.get("amount") ?? ""));
  const dateRaw = String(formData.get("date") ?? "");
  const category = String(formData.get("category") ?? expense.category);
  const notes = String(formData.get("notes") ?? "").trim();
  const receipt = formData.get("receipt");

  if (!title) redirect(`${backPath}?error=${encodeURIComponent("Title is required.")}`);
  if (amountCents === null || amountCents <= 0) {
    redirect(`${backPath}?error=${encodeURIComponent("Enter a valid dollar amount.")}`);
  }

  let receiptPath = expense.receiptPath;
  if (receipt instanceof File && receipt.size > 0) {
    try {
      receiptPath = await saveReceipt(receipt);
    } catch (error) {
      redirect(
        `${backPath}?error=${encodeURIComponent(error instanceof Error ? error.message : "Bad receipt")}`,
      );
    }
  }

  const before = {
    title: expense.title,
    amountCents: expense.amountCents,
    category: expense.category,
    date: expense.date.toISOString(),
    notes: expense.notes,
  };
  await db.expense.update({
    where: { id: expenseId },
    data: {
      title,
      amountCents,
      category,
      notes,
      receiptPath,
      ...(dateRaw ? { date: parseDateInput(dateRaw) ?? undefined } : {}),
    },
  });
  await audit(member, AuditAction.EXPENSE_EDITED, "Expense", expenseId, {
    before,
    after: { title, amountCents, category, notes },
  });
  revalidatePath("/", "layout");
  redirect(`/expenses/${expenseId}`);
}

/** Delete an expense (owner or parent) — the audit trail keeps the details. */
export async function deleteExpense(expenseId: string) {
  const member = await requireMember();

  const expense = await db.expense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.familyId !== member.familyId) return;
  if (!canTouchExpense(member, expense)) return;

  await audit(member, AuditAction.EXPENSE_DELETED, "Expense", expenseId, {
    title: expense.title,
    amountCents: expense.amountCents,
    date: expense.date.toISOString(),
    memberId: expense.memberId,
  });
  await db.expense.delete({ where: { id: expenseId } });
  revalidatePath("/", "layout");
  redirect("/expenses");
}
