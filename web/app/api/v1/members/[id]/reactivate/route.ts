import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { apiError, json, withAuth } from "@/lib/api";

/** POST — restore a former member (parents only). */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (actor, _request, { params }) => {
    if (actor.role !== "PARENT") return apiError("Only parents can restore members", 403);
    const { id } = await params;
    const target = await db.member.findUnique({ where: { id } });
    if (!target || target.familyId !== actor.familyId) return apiError("Member not found", 404);

    await db.member.update({ where: { id }, data: { deactivatedAt: null } });
    await audit(actor, AuditAction.MEMBER_REACTIVATED, "Member", id, { name: target.name });
    return json({ ok: true });
  },
);
