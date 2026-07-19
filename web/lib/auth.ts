import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";

const SESSION_COOKIE = "sbk_session";
const SESSION_DAYS = 30;
const IMPERSONATION_HOURS = 1; // admin "view as" sessions are short-lived
const RESET_TOKEN_HOURS = 1;
const LOCKOUT_THRESHOLD = 10; // consecutive failures before locking
const LOCKOUT_MINUTES = 15;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set in production");
    }
    return new TextEncoder().encode("sribookkeeping-dev-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

// MARK: passwords

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Random temporary password for emailed invites (no ambiguous 0/O/1/l/I).
 * The account is created with mustChangePassword, so this only ever grants
 * one sign-in that leads straight to the change-password screen.
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () => alphabet[crypto.randomInt(alphabet.length)]).join("");
}

// MARK: durable brute-force lockout
// Persisted per-member, so it survives restarts and works across multiple
// server instances (unlike the in-memory IP limiter, which is a first layer).

/** True if the account is currently locked. */
export function isLockedOut(member: { lockedUntil: Date | null }): boolean {
  return member.lockedUntil !== null && member.lockedUntil > new Date();
}

/** Records a failed sign-in; locks the account after too many in a row. */
export async function recordFailedLogin(memberId: string): Promise<void> {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { failedLogins: true },
  });
  const failed = (member?.failedLogins ?? 0) + 1;
  await db.member.update({
    where: { id: memberId },
    data: {
      failedLogins: failed,
      lockedUntil:
        failed >= LOCKOUT_THRESHOLD
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : undefined,
    },
  });
}

/** Clears the failure counter on a successful sign-in. */
export async function clearFailedLogins(memberId: string): Promise<void> {
  await db.member.update({
    where: { id: memberId },
    data: { failedLogins: 0, lockedUntil: null },
  });
}

export const LOCKOUT_MESSAGE = `Too many failed attempts — this account is locked for ${LOCKOUT_MINUTES} minutes.`;

// MARK: tokens
// `imp` carries the platform admin's member id while impersonating (those
// tokens expire after IMPERSONATION_HOURS, not 30 days). `ver` is the
// member's tokenVersion at issue time — bumping it on password change/reset
// kills every previously issued session immediately.

export async function createToken(
  memberId: string,
  tokenVersion: number,
  impersonatorId?: string,
): Promise<string> {
  return new SignJWT({
    sub: memberId,
    ver: tokenVersion,
    ...(impersonatorId ? { imp: impersonatorId } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(impersonatorId ? `${IMPERSONATION_HOURS}h` : `${SESSION_DAYS}d`)
    .sign(secretKey());
}

type TokenPayload = { memberId: string; impersonatorId: string | null; tokenVersion: number };

export async function verifyToken(token: string): Promise<string | null> {
  return (await verifySessionToken(token))?.memberId ?? null;
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    return {
      memberId: payload.sub,
      impersonatorId: typeof payload.imp === "string" ? payload.imp : null,
      tokenVersion: typeof payload.ver === "number" ? payload.ver : 0,
    };
  } catch {
    return null;
  }
}

// MARK: web sessions (cookie)

export async function createSession(memberId: string, impersonatorId?: string): Promise<void> {
  const target = await db.member.findUnique({
    where: { id: memberId },
    select: { tokenVersion: true },
  });
  const token = await createToken(memberId, target?.tokenVersion ?? 0, impersonatorId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export type SessionMember = NonNullable<Awaited<ReturnType<typeof memberById>>> & {
  /** Platform admin driving this session, if impersonating. */
  impersonatorId?: string | null;
};

function memberById(id: string) {
  return db.member.findUnique({
    where: { id },
    include: { family: { include: { members: true } } },
  });
}

async function memberFromPayload(payload: TokenPayload | null): Promise<SessionMember | null> {
  if (!payload) return null;
  const member = (await memberById(payload.memberId)) as SessionMember | null;
  if (!member) return null;
  // Session revocation: tokens issued before the last password change carry
  // an older version and stop working immediately.
  if (member.tokenVersion !== payload.tokenVersion) return null;
  // A deactivated member is signed out everywhere.
  if (member.deactivatedAt) return null;
  member.impersonatorId = payload.impersonatorId;
  return member;
}

/** Active (non-deactivated) members of the family — for pickers/assignment. */
export function activeMembers(member: SessionMember) {
  return member.family.members.filter((m) => !m.deactivatedAt);
}

/** Current member from the session cookie, or null. */
export async function getCurrentMember(): Promise<SessionMember | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return memberFromPayload(await verifySessionToken(token));
}

/** Page guard: redirects to /login when signed out. */
export async function requireMember(): Promise<SessionMember> {
  const member = await getCurrentMember();
  if (!member) redirect("/login");
  return member;
}

/** API guard: Authorization: Bearer <token> (mobile) or session cookie (web). */
export async function getApiMember(request: Request): Promise<SessionMember | null> {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return memberFromPayload(await verifySessionToken(header.slice(7)));
  }
  return getCurrentMember();
}

// MARK: roles

/** Active parents — used for approval hints and last-parent guards. */
export function parents(member: SessionMember) {
  return member.family.members.filter((m) => m.role === "PARENT" && !m.deactivatedAt);
}

export function isParent(member: { role: string }): boolean {
  return member.role === "PARENT";
}

/** Parents, guardians, and grandparents: family-wide visibility (not approval power). */
export function isAdult(member: { role: string }): boolean {
  return member.role !== "CHILD";
}

// MARK: platform admin & impersonation

export function isPlatformAdmin(member: { isPlatformAdmin?: boolean }): boolean {
  return member.isPlatformAdmin === true;
}

/** Page guard for /admin: the signed-in member must be a platform admin. */
export async function requireAdmin(): Promise<SessionMember> {
  const member = await requireMember();
  if (!isPlatformAdmin(member)) redirect("/dashboard");
  return member;
}

// MARK: password reset (forgot password / find account)

/** Creates a one-hour, single-use reset token; returns the raw token for the email link. */
export async function createResetToken(memberId: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: {
      memberId,
      tokenHash: crypto.createHash("sha256").update(raw).digest("hex"),
      expiresAt: new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000),
    },
  });
  return raw;
}

/** Validates a raw reset token without consuming it. */
export async function peekResetToken(raw: string): Promise<string | null> {
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  return record.memberId;
}

/** Consumes a raw reset token; returns the memberId it belongs to, or null. */
export async function consumeResetToken(raw: string): Promise<string | null> {
  const memberId = await peekResetToken(raw);
  if (!memberId) return null;
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await db.passwordResetToken.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });
  return memberId;
}
