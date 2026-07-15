import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { Role } from "@/lib/types";
import { apiError, json, serializeMember, withAuth } from "@/lib/api";

async function activeParentCount(familyId: string, excludeId?: string): Promise<number> {
  const parents = await db.member.findMany({
    where: { familyId, role: Role.PARENT, deactivatedAt: null },
    select: { id: true },
  });
  return parents.filter((p) => p.id !== excludeId).length;
}

/**
 * PATCH { name?, role?, emoji?, email?, password? } — parents edit a member.
 * Setting email/password attaches (or updates) a sign-in. Guards keep at least
 * one active parent.
 */
export const PATCH = withAuth<{ params: Promise<{ id: string }> }>(
  async (actor, request, { params }) => {
    if (actor.role !== "PARENT") return apiError("Only parents can edit members", 403);
    const { id } = await params;
    const target = await db.member.findUnique({ where: { id } });
    if (!target || target.familyId !== actor.familyId) return apiError("Member not found", 404);

    let body: { name?: string; role?: string; emoji?: string; email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (!name) return apiError("name can't be empty", 400);
      data.name = name;
    }
    if (body.emoji !== undefined) data.emoji = body.emoji.trim().slice(0, 4) || target.emoji;
    if (body.role !== undefined) {
      if (!Object.values(Role).includes(body.role as Role)) return apiError("Invalid role", 400);
      if (
        target.role === Role.PARENT &&
        body.role !== Role.PARENT &&
        !target.deactivatedAt &&
        (await activeParentCount(target.familyId, target.id)) === 0
      ) {
        return apiError("The family needs at least one parent", 409);
      }
      data.role = body.role;
    }
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (email && email !== (target.email ?? "")) {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return apiError("Invalid email", 400);
        const existing = await db.member.findUnique({ where: { email } });
        if (existing && existing.id !== target.id) return apiError("Email already in use", 409);
        data.email = email;
      }
    }
    if (body.password) {
      if (body.password.length < 8) return apiError("Password must be 8+ characters", 400);
      if (!data.email && !target.email) return apiError("Add an email for the sign-in", 400);
      data.passwordHash = await hashPassword(body.password);
      data.tokenVersion = { increment: 1 };
    }
    if (Object.keys(data).length === 0) return apiError("Nothing to change", 400);

    const updated = await db.member.update({ where: { id }, data });
    await audit(actor, AuditAction.MEMBER_UPDATED, "Member", id, { fields: Object.keys(data) });
    return json({ member: serializeMember(updated) });
  },
);
