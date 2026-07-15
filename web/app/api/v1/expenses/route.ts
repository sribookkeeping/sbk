import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { parseDateInput } from "@/lib/format";
import { saveReceipt } from "@/lib/storage";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

function serializeExpense(e: {
  id: string;
  memberId: string;
  title: string;
  amountCents: number;
  date: Date;
  category: string;
  notes: string;
}) {
  return {
    id: e.id,
    memberId: e.memberId,
    title: e.title,
    amountCents: e.amountCents,
    date: e.date.toISOString(),
    category: e.category,
    notes: e.notes,
    receiptUrl: `/api/receipts/${e.id}`,
  };
}

/** GET → expenses (kids: own; adults: whole family). */
export const GET = withAuth(async (member) => {
  const expenses = await db.expense.findMany({
    where:
      member.role !== "CHILD" ? { familyId: member.familyId } : { memberId: member.id },
    orderBy: { date: "desc" },
  });
  return json({ expenses: expenses.map(serializeExpense) });
});

/**
 * POST multipart/form-data:
 *   title, amountCents, date?, category?, notes?, memberId? (parents only),
 *   receipt (image file, REQUIRED — requirement 12)
 */
export const POST = withAuth(async (member, request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError("Expected multipart/form-data", 400);
  }

  const title = String(form.get("title") ?? "").trim();
  const amountCents = Math.round(Number(form.get("amountCents") ?? 0));
  const dateRaw = String(form.get("date") ?? "");
  const category = String(form.get("category") ?? "OTHER");
  const notes = String(form.get("notes") ?? "").trim();
  const receipt = form.get("receipt");

  const requestedMemberId = String(form.get("memberId") ?? member.id);
  const payer =
    member.role !== "CHILD" // adults can record an expense for anyone
      ? member.family.members.find((m) => m.id === requestedMemberId)
      : member;

  if (!payer) return apiError("Invalid memberId", 400);
  if (!title) return apiError("title is required", 400);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return apiError("amountCents must be positive", 400);
  }
  if (!EXPENSE_CATEGORIES.some((c) => c.value === category)) {
    return apiError("Invalid category", 400);
  }
  if (!(receipt instanceof File) || receipt.size === 0) {
    return apiError("receipt image file is required", 400);
  }

  let receiptPath: string;
  try {
    receiptPath = await saveReceipt(receipt);
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Could not save receipt", 400);
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
  return json({ expense: serializeExpense(expense) }, 201);
});
