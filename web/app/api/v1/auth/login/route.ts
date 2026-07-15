import { db } from "@/lib/db";
import {
  createToken,
  verifyPassword,
  isLockedOut,
  recordFailedLogin,
  clearFailedLogins,
  LOCKOUT_MESSAGE,
} from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { apiError, json, serializeMember } from "@/lib/api";

/** POST { email, password } → { token, member, family } */
export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(`api-login:${ip}`) || isRateLimited(`api-login:${email}`)) {
    return apiError("Too many attempts — wait a minute and try again", 429);
  }

  const member = await db.member.findUnique({
    where: { email },
    include: { family: { include: { members: true } } },
  });
  // Durable per-account lockout (survives restarts / multiple instances).
  if (member && isLockedOut(member)) return apiError(LOCKOUT_MESSAGE, 429);

  if (!member?.passwordHash || !(await verifyPassword(password, member.passwordHash))) {
    if (member) await recordFailedLogin(member.id);
    return apiError("Wrong email or password", 401);
  }

  await clearFailedLogins(member.id);
  return json({
    token: await createToken(member.id, member.tokenVersion),
    member: serializeMember(member),
    family: {
      id: member.family.id,
      name: member.family.name,
      members: member.family.members.map(serializeMember),
    },
  });
}
