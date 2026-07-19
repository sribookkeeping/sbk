"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent, hashPassword, generateTempPassword } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { isValidTimeZone } from "@/lib/format";
import { Role } from "@/lib/types";

function fail(message: string): never {
  redirect(`/family?error=${encodeURIComponent(message)}`);
}

/** Parents add spouse/children to the household (requirement 1). */
export async function addMember(formData: FormData) {
  const member = await requireMember();
  if (!isParent(member)) fail("Only parents can add family members.");

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? Role.CHILD);
  const emoji = String(formData.get("emoji") ?? "").trim() || DEFAULT_EMOJI[role] || "🙂";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) fail("The member needs a name.");
  if (!Object.values(Role).includes(role as Role)) fail("Pick a role.");
  if (!email) fail("Every member needs an email address.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Enter a valid email address.");

  const existing = await db.member.findUnique({ where: { email } });
  if (existing) fail("That email is already in use.");

  // Every member gets an emailed temporary password; first sign-in forces
  // choosing a real one.
  const tempPassword = generateTempPassword();
  const created = await db.member.create({
    data: {
      familyId: member.familyId,
      name,
      role,
      emoji: emoji.slice(0, 4),
      email,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
  });

  try {
    const url = process.env.APP_URL || "http://localhost:3000";
    await sendEmail({
      to: email,
      subject: `You've been added to ${member.family.name} on SriBookKeeping`,
      html: `<p>Hi ${name},</p>
<p>${member.name} added you to <strong>${member.family.name}</strong>.</p>
<p>Sign in at <a href="${url}/login">${url}/login</a> with:</p>
<p>Email: <strong>${email}</strong><br>
Temporary password: <strong>${tempPassword}</strong></p>
<p>You'll be asked to choose your own password the first time you sign in.</p>`,
    });
  } catch {
    await db.member.delete({ where: { id: created.id } });
    fail("We couldn't send the invite email — the member wasn't added. Try again.");
  }

  await audit(member, AuditAction.MEMBER_ADDED, "Member", created.id, { name, role });
  revalidatePath("/family");
  redirect("/family");
}

const DEFAULT_EMOJI: Record<string, string> = {
  [Role.PARENT]: "🧑",
  [Role.GUARDIAN]: "🧑‍🦱",
  [Role.GRANDPARENT]: "👵",
  [Role.CHILD]: "🧒",
};

/** How many active parents the family would have if `exclude` were removed/demoted. */
async function activeParentCount(familyId: string, excludeId?: string): Promise<number> {
  const parents = await db.member.findMany({
    where: { familyId, role: Role.PARENT, deactivatedAt: null },
    select: { id: true },
  });
  return parents.filter((p) => p.id !== excludeId).length;
}

/**
 * Parents edit a member: name, emoji, role, and — for a member without one —
 * add a sign-in (email + password). Guards keep at least one active parent.
 */
export async function updateMember(memberId: string, formData: FormData) {
  const actor = await requireMember();
  if (!isParent(actor)) fail("Only parents can edit family members.");

  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target || target.familyId !== actor.familyId) fail("Member not found.");

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? target.role);
  const emoji = String(formData.get("emoji") ?? "").trim() || target.emoji;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) fail("The member needs a name.");
  if (!Object.values(Role).includes(role as Role)) fail("Pick a role.");

  // Demoting the last active parent would strand approvals — block it.
  if (
    target.role === Role.PARENT &&
    role !== Role.PARENT &&
    !target.deactivatedAt &&
    (await activeParentCount(target.familyId, target.id)) === 0
  ) {
    fail("The family needs at least one parent — add or promote another first.");
  }

  const data: Record<string, unknown> = { name, role, emoji: emoji.slice(0, 4) };

  // Optionally attach a sign-in to a member who has none yet.
  if (email && email !== (target.email ?? "")) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Enter a valid email address.");
    const existing = await db.member.findUnique({ where: { email } });
    if (existing && existing.id !== target.id) fail("That email is already in use.");
    data.email = email;
  }
  if (password) {
    if (password.length < 8) fail("Password must be at least 8 characters.");
    if (!email && !target.email) fail("Add an email to give this member a sign-in.");
    data.passwordHash = await hashPassword(password);
    // Changing/setting the password revokes any old sessions.
    data.tokenVersion = { increment: 1 };
  }

  await db.member.update({ where: { id: memberId }, data });
  await audit(actor, AuditAction.MEMBER_UPDATED, "Member", memberId, {
    before: { name: target.name, role: target.role, emoji: target.emoji },
    after: { name, role, emoji: emoji.slice(0, 4) },
    addedSignIn: Boolean(email && !target.email),
  });
  revalidatePath("/family");
  redirect("/family?updated=1");
}

/** Parents deactivate a member who left — history is kept; they can't sign in. */
export async function deactivateMember(memberId: string) {
  const actor = await requireMember();
  if (!isParent(actor)) fail("Only parents can remove family members.");
  if (memberId === actor.id) fail("You can't remove yourself.");

  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target || target.familyId !== actor.familyId) fail("Member not found.");
  if (target.deactivatedAt) fail("That member is already removed.");

  if (target.role === Role.PARENT && (await activeParentCount(target.familyId, target.id)) === 0) {
    fail("The family needs at least one parent — add or promote another first.");
  }

  await db.member.update({
    where: { id: memberId },
    // Bump tokenVersion so any existing session dies immediately.
    data: { deactivatedAt: new Date(), tokenVersion: { increment: 1 } },
  });
  await audit(actor, AuditAction.MEMBER_DEACTIVATED, "Member", memberId, { name: target.name });
  revalidatePath("/family");
  redirect("/family?removed=1");
}

/** Parents bring a former member back. */
export async function reactivateMember(memberId: string) {
  const actor = await requireMember();
  if (!isParent(actor)) fail("Only parents can restore family members.");

  const target = await db.member.findUnique({ where: { id: memberId } });
  if (!target || target.familyId !== actor.familyId) fail("Member not found.");

  await db.member.update({ where: { id: memberId }, data: { deactivatedAt: null } });
  await audit(actor, AuditAction.MEMBER_REACTIVATED, "Member", memberId, { name: target.name });
  revalidatePath("/family");
  redirect("/family?restored=1");
}

/** Parents set the family's IANA timezone (drives schedule/reminder math). */
export async function setFamilyTimezone(formData: FormData) {
  const member = await requireMember();
  if (!isParent(member)) fail("Only parents can change the family timezone.");

  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!isValidTimeZone(timezone)) fail("Pick a valid timezone.");

  await db.family.update({ where: { id: member.familyId }, data: { timezone } });
  await audit(member, AuditAction.FAMILY_UPDATED, "Family", member.familyId, { timezone });
  revalidatePath("/family");
  redirect("/family?tz=1");
}
