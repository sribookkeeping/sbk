"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, getCurrentMember, isPlatformAdmin, requireAdmin } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";

/**
 * Platform admin: sign in AS a member (support/debugging). The session keeps
 * the admin's id, so every audited action records who was really driving.
 */
export async function impersonate(memberId: string) {
  const admin = await requireAdmin();

  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target) redirect("/admin?error=Member+not+found");

  await audit(
    { id: admin.id, name: admin.name, familyId: target.familyId },
    AuditAction.IMPERSONATION_STARTED,
    "Member",
    target.id,
    { admin: admin.name, target: target.name },
  );
  await createSession(target.id, admin.id);
  redirect("/dashboard");
}

/** Return from an impersonated session to the admin's own account. */
export async function stopImpersonating() {
  const member = await getCurrentMember();
  if (!member?.impersonatorId) redirect("/dashboard");

  const admin = await db.member.findUnique({ where: { id: member.impersonatorId } });
  if (!admin || !isPlatformAdmin(admin)) {
    redirect("/dashboard");
  }

  await audit(
    { id: admin.id, name: admin.name, familyId: member.familyId },
    AuditAction.IMPERSONATION_ENDED,
    "Member",
    member.id,
    { admin: admin.name, target: member.name },
  );
  await createSession(admin.id);
  redirect("/admin");
}
