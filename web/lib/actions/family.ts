"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember, isParent, hashPassword } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { isValidTimeZone } from "@/lib/format";
import { Role } from "@/lib/types";

function fail(message: string): never {
  redirect(`/family?error=${encodeURIComponent(message)}`);
}

/** Parents add spouse/children to the household (requirement 1). */
export async function addMember(formData: FormData) {
  const member = await requireMember();
  if (!isParent(member)) fail("Only parents can add family members.");

  const DEFAULT_EMOJI: Record<string, string> = {
    [Role.PARENT]: "🧑",
    [Role.GUARDIAN]: "🧑‍🦱",
    [Role.GRANDPARENT]: "👵",
    [Role.CHILD]: "🧒",
  };

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? Role.CHILD);
  const emoji = String(formData.get("emoji") ?? "").trim() || DEFAULT_EMOJI[role] || "🙂";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name) fail("The member needs a name.");
  if (!Object.values(Role).includes(role as Role)) fail("Pick a role.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Enter a valid email address.");
  if (email && password.length < 8) fail("Password must be at least 8 characters for a sign-in.");
  if (!email && password) fail("Add an email to give this member a sign-in.");

  if (email) {
    const existing = await db.member.findUnique({ where: { email } });
    if (existing) fail("That email is already in use.");
  }

  const created = await db.member.create({
    data: {
      familyId: member.familyId,
      name,
      role,
      emoji: emoji.slice(0, 4),
      email: email || null,
      passwordHash: email ? await hashPassword(password) : null,
    },
  });

  await audit(member, AuditAction.MEMBER_ADDED, "Member", created.id, { name, role });
  revalidatePath("/family");
  redirect("/family");
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
