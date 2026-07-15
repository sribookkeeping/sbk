"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  createSession,
  createResetToken,
  consumeResetToken,
  destroySession,
  hashPassword,
  requireMember,
  verifyPassword,
  isLockedOut,
  recordFailedLogin,
  clearFailedLogins,
  LOCKOUT_MESSAGE,
} from "@/lib/auth";
import { isValidTimeZone } from "@/lib/format";
import { audit, AuditAction } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { isRateLimited } from "@/lib/rate-limit";
import { Role } from "@/lib/types";

async function clientKey(route: string): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${route}:${ip}`;
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/** Head of family registers the household (requirement 1). */
export async function register(formData: FormData) {
  const familyName = String(formData.get("familyName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!familyName || !name) fail("/register", "Family name and your name are required.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("/register", "Enter a valid email address.");
  if (password.length < 8) fail("/register", "Password must be at least 8 characters.");

  const existing = await db.member.findUnique({ where: { email } });
  if (existing) fail("/register", "That email is already registered — try signing in.");

  // Browser-captured IANA timezone → schedule math runs in the family's day.
  const timezone = String(formData.get("timezone") ?? "").trim();
  const family = await db.family.create({
    data: {
      name: familyName,
      ...(timezone && isValidTimeZone(timezone) ? { timezone } : {}),
    },
  });
  const head = await db.member.create({
    data: {
      familyId: family.id,
      name,
      role: Role.PARENT,
      isHead: true,
      emoji: "🧑‍💼",
      email,
      passwordHash: await hashPassword(password),
    },
  });

  await createSession(head.id);
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Throttle by caller IP and by target account, so one address can't be
  // brute-forced from many IPs (or one IP across many accounts).
  if (isRateLimited(await clientKey("login")) || isRateLimited(`login-email:${email}`)) {
    fail("/login", "Too many attempts — wait a minute and try again.");
  }

  const member = await db.member.findUnique({ where: { email } });
  if (member?.deactivatedAt) fail("/login", "This account is no longer active.");
  // Durable per-account lockout (survives restarts / multiple instances).
  if (member && isLockedOut(member)) fail("/login", LOCKOUT_MESSAGE);

  if (!member?.passwordHash || !(await verifyPassword(password, member.passwordHash))) {
    if (member) await recordFailedLogin(member.id);
    fail("/login", "Wrong email or password.");
  }

  await clearFailedLogins(member.id);
  await createSession(member.id);
  await audit(member, AuditAction.MEMBER_SIGNED_IN, "Member", member.id, {});
  redirect("/dashboard");
}

/** Emails a one-hour reset link. Never reveals whether the email exists. */
export async function forgotPassword(formData: FormData) {
  if (isRateLimited(await clientKey("forgot"))) {
    fail("/forgot-password", "Too many attempts — wait a minute and try again.");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) fail("/forgot-password", "Enter your email address.");

  const member = await db.member.findUnique({ where: { email } });
  if (member) {
    const token = await createResetToken(member.id);
    await sendEmail({
      to: email,
      subject: "Reset your SriBookKeeping password",
      html: `<p>Hi ${member.name},</p>
<p><a href="${appUrl()}/reset-password?token=${token}">Reset your password</a> (link valid for 1 hour).</p>
<p>If you didn't ask for this, you can ignore this email.</p>`,
    });
  }
  redirect("/forgot-password?sent=1");
}

/** Sets a new password from a valid reset-token link. */
export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const backPath = `/reset-password?token=${encodeURIComponent(token)}`;

  if (password.length < 8) fail(backPath, "Password must be at least 8 characters.");
  if (password !== confirm) fail(backPath, "Passwords don't match.");

  const memberId = await consumeResetToken(token);
  if (!memberId) fail("/forgot-password", "That reset link is invalid or expired — request a new one.");

  const member = await db.member.update({
    where: { id: memberId },
    data: {
      passwordHash: await hashPassword(password),
      // Revoke every previously issued session/token immediately.
      tokenVersion: { increment: 1 },
    },
  });
  await audit(member, AuditAction.PASSWORD_RESET, "Member", member.id, {});
  await createSession(member.id);
  redirect("/dashboard");
}

/**
 * "Find my account": emails the account details (member name, family, sign-in
 * email) for the address entered. Never reveals whether the email exists.
 */
export async function findAccount(formData: FormData) {
  if (isRateLimited(await clientKey("find"))) {
    fail("/find-account", "Too many attempts — wait a minute and try again.");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) fail("/find-account", "Enter your email address.");

  const member = await db.member.findUnique({
    where: { email },
    include: { family: true },
  });
  if (member) {
    await sendEmail({
      to: email,
      subject: "Your SriBookKeeping account",
      html: `<p>Hi ${member.name},</p>
<p>Your account: <strong>${member.name}</strong> in <strong>${member.family.name}</strong>.</p>
<p>You sign in with this email address: <strong>${email}</strong>.</p>
<p>Forgot your password? <a href="${appUrl()}/forgot-password">Reset it here</a>.</p>`,
    });
  }
  redirect("/find-account?sent=1");
}

/**
 * Change password while signed in: requires the current password, revokes all
 * other sessions (tokenVersion bump), and re-issues this one.
 */
export async function changePassword(formData: FormData) {
  const member = await requireMember();
  const backPath = "/family";

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!member.passwordHash) fail(backPath, "This profile has no sign-in yet.");
  if (!(await verifyPassword(current, member.passwordHash))) {
    fail(backPath, "Current password is wrong.");
  }
  if (next.length < 8) fail(backPath, "New password must be at least 8 characters.");
  if (next !== confirm) fail(backPath, "New passwords don't match.");

  await db.member.update({
    where: { id: member.id },
    data: {
      passwordHash: await hashPassword(next),
      tokenVersion: { increment: 1 }, // sign out every other device
    },
  });
  await audit(member, AuditAction.PASSWORD_CHANGED, "Member", member.id, {});
  await createSession(member.id); // keep THIS session alive on the new version
  redirect("/family?pwd=1");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
