import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { Role } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

async function activeParentCount(familyId: string, excludeId?: string): Promise<number> {
  const parents = await db.member.findMany({
    where: { familyId, role: Role.PARENT, deactivatedAt: null },
    select: { id: true },
  });
  return parents.filter((p) => p.id !== excludeId).length;
}

/** POST — deactivate a member (parents only). History is kept; sign-in dies. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (actor, _request, { params }) => {
    if (actor.role !== "PARENT") return apiError("Only parents can remove members", 403);
    const { id } = await params;
    if (id === actor.id) return apiError("You can't remove yourself", 409);

    const target = await db.member.findUnique({ where: { id } });
    if (!target || target.familyId !== actor.familyId) return apiError("Member not found", 404);
    if (target.deactivatedAt) return apiError("Already removed", 409);
    if (target.role === Role.PARENT && (await activeParentCount(target.familyId, target.id)) === 0) {
      return apiError("The family needs at least one parent", 409);
    }

    await db.member.update({
      where: { id },
      data: { deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
    });
    await audit(actor, AuditAction.MEMBER_DEACTIVATED, "Member", id, { name: target.name });
    return json({ ok: true });
  },
);
