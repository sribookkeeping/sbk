import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { parseDateInput } from "@/lib/format";
import { saveReceipt } from "@/lib/storage";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

function canTouch(member: { id: string; role: string }, expense: { memberId: string }): boolean {
  return expense.memberId === member.id || member.role === "PARENT";
}

/**
 * PATCH multipart/form-data or JSON: title?, amountCents?, date?, category?,
 * notes?, receipt? (new image) — edit an expense (owner or parent; audited).
 */
export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense || expense.familyId !== member.familyId) return apiError("Not found", 404);
    if (!canTouch(member, expense)) return apiError("Only the owner or a parent can edit", 403);

    const contentType = request.headers.get("content-type") ?? "";
    let fields: Record<string, string> = {};
    let receipt: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (value instanceof File) {
          if (key === "receipt" && value.size > 0) receipt = value;
        } else {
          fields[key] = String(value);
        }
      }
    } else {
      try {
        fields = await request.json();
      } catch {
        return apiError("Invalid body", 400);
      }
    }

    const data: Record<string, unknown> = {};
    if (fields.title !== undefined) {
      const title = String(fields.title).trim();
      if (!title) return apiError("title can't be empty", 400);
      data.title = title;
    }
    if (fields.amountCents !== undefined) {
      const amountCents = Math.round(Number(fields.amountCents));
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return apiError("amountCents must be positive", 400);
      }
      data.amountCents = amountCents;
    }
    if (fields.category !== undefined) {
      if (!EXPENSE_CATEGORIES.some((c) => c.value === fields.category)) {
        return apiError("Invalid category", 400);
      }
      data.category = fields.category;
    }
    if (fields.date !== undefined && fields.date) {
      data.date = parseDateInput(String(fields.date)) ?? undefined;
    }
    if (fields.notes !== undefined) data.notes = String(fields.notes).trim();
    if (receipt) {
      try {
        data.receiptPath = await saveReceipt(receipt);
      } catch (error) {
        return apiError(error instanceof Error ? error.message : "Bad receipt", 400);
      }
    }
    if (Object.keys(data).length === 0) return apiError("Nothing to change", 400);

    const before = {
      title: expense.title,
      amountCents: expense.amountCents,
      category: expense.category,
      notes: expense.notes,
    };
    await db.expense.update({ where: { id }, data });
    await audit(member, AuditAction.EXPENSE_EDITED, "Expense", id, { before, after: data });
    return json({ ok: true });
  },
);

/** DELETE — remove an expense (owner or parent; details kept in the audit log). */
export const DELETE = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, _request, { params }) => {
    const { id } = await params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense || expense.familyId !== member.familyId) return apiError("Not found", 404);
    if (!canTouch(member, expense)) return apiError("Only the owner or a parent can delete", 403);

    await audit(member, AuditAction.EXPENSE_DELETED, "Expense", id, {
      title: expense.title,
      amountCents: expense.amountCents,
      date: expense.date.toISOString(),
    });
    await db.expense.delete({ where: { id } });
    return json({ ok: true });
  },
);
