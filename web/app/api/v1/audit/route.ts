import { familyAudit } from "@/lib/audit";
import { apiError, json, withAuth } from "@/lib/api";

/** GET → the family audit log (parents only). */
export const GET = withAuth(async (member) => {
  if (member.role !== "PARENT") return apiError("Parents only", 403);

  const entries = await familyAudit(member.familyId);
  return json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      actorName: e.actorName,
      viaAdmin: e.impersonatorId !== null,
      entityType: e.entityType,
      entityId: e.entityId,
      details: e.details,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});
