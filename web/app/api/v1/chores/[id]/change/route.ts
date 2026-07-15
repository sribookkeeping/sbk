import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { submitChoreChange, type ChoreEditPayload } from "@/lib/approvals";
import { apiError, json, withAuth } from "@/lib/api";

/**
 * POST { title?, details?, amountCents?, delete? } — propose a chore edit or
 * deletion. Parents only; BOTH parents must approve (proposer counts as one;
 * sole parent applies immediately). Returns { outcome: "applied" | "pending" }.
 */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    if (member.role !== "PARENT") return apiError("Only parents can change chores", 403);

    const { id } = await params;
    const chore = await db.chore.findUnique({ where: { id } });
    if (!chore || chore.familyId !== member.familyId || chore.deletedAt) {
      return apiError("Chore not found", 404);
    }

    let body: { title?: string; details?: string; amountCents?: number; delete?: boolean };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const isDelete = body.delete === true;
    const changes: ChoreEditPayload = {};
    if (!isDelete) {
      if (typeof body.title === "string" && body.title.trim() && body.title !== chore.title) {
        changes.title = body.title.trim();
      }
      if (typeof body.details === "string" && body.details !== chore.details) {
        changes.details = body.details;
      }
      if (
        typeof body.amountCents === "number" &&
        body.amountCents > 0 &&
        Math.round(body.amountCents) !== chore.amountCents
      ) {
        changes.amountCents = Math.round(body.amountCents);
      }
      if (Object.keys(changes).length === 0) return apiError("Nothing changed", 400);
    }

    const outcome = await submitChoreChange(id, changes, isDelete, member);
    await audit(
      member,
      isDelete
        ? outcome === "applied"
          ? AuditAction.CHORE_DELETED
          : AuditAction.CHORE_DELETE_PROPOSED
        : outcome === "applied"
          ? AuditAction.CHORE_EDITED
          : AuditAction.CHORE_EDIT_PROPOSED,
      "Chore",
      id,
      { proposed: changes, isDelete, outcome },
    );
    return json({ outcome });
  },
);
