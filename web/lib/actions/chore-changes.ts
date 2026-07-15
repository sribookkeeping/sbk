"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { submitChoreChange, type ChoreEditPayload } from "@/lib/approvals";
import { parseMoney } from "@/lib/format";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/**
 * Propose editing a chore (title/details/amount). Parents only; BOTH parents
 * must approve (the proposer counts as one). Audited for parent review.
 */
export async function proposeChoreEdit(choreId: string, formData: FormData) {
  const member = await requireMember();
  const backPath = `/chores/${choreId}/edit`;
  if (!isParent(member)) fail("/chores", "Only parents can edit chores.");

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  if (!chore || chore.familyId !== member.familyId || chore.deletedAt) {
    fail("/chores", "Chore not found.");
  }

  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const amountCents = parseMoney(String(formData.get("amount") ?? ""));

  if (!title) fail(backPath, "The chore needs a title.");
  if (amountCents === null || amountCents <= 0) fail(backPath, "Enter a valid dollar amount.");

  const changes: ChoreEditPayload = {};
  if (title !== chore.title) changes.title = title;
  if (details !== chore.details) changes.details = details;
  if (amountCents !== chore.amountCents) changes.amountCents = amountCents;
  if (Object.keys(changes).length === 0) fail(backPath, "Nothing changed.");

  const outcome = await submitChoreChange(choreId, changes, false, member);

  await audit(
    member,
    outcome === "applied" ? AuditAction.CHORE_EDITED : AuditAction.CHORE_EDIT_PROPOSED,
    "Chore",
    choreId,
    {
      before: { title: chore.title, details: chore.details, amountCents: chore.amountCents },
      proposed: changes,
      outcome,
    },
  );
  revalidatePath("/", "layout");
  redirect(outcome === "applied" ? "/chores" : "/approvals");
}

/** Propose deleting a chore. Parents only; both parents must approve. */
export async function proposeChoreDelete(choreId: string) {
  const member = await requireMember();
  if (!isParent(member)) return;

  const chore = await db.chore.findUnique({ where: { id: choreId } });
  if (!chore || chore.familyId !== member.familyId || chore.deletedAt) return;

  const outcome = await submitChoreChange(choreId, {}, true, member);

  await audit(
    member,
    outcome === "applied" ? AuditAction.CHORE_DELETED : AuditAction.CHORE_DELETE_PROPOSED,
    "Chore",
    choreId,
    { title: chore.title, amountCents: chore.amountCents, outcome },
  );
  revalidatePath("/", "layout");
  redirect(outcome === "applied" ? "/chores" : "/approvals");
}
