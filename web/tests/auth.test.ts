import { describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { db } from "@/lib/db";
import {
  consumeResetToken,
  createResetToken,
  createToken,
  getApiMember,
  hashPassword,
  peekResetToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { makeFamily } from "./helpers";

function bearerRequest(token: string): Request {
  return new Request("http://localhost/api/v1/me", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("passwords & session tokens", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("hunter22");
    expect(await verifyPassword("hunter22", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("session tokens carry member, version, and (optionally) the impersonating admin", async () => {
    const plain = await createToken("member-1", 0);
    expect(await verifySessionToken(plain)).toEqual({
      memberId: "member-1",
      impersonatorId: null,
      tokenVersion: 0,
    });

    const impersonated = await createToken("member-1", 3, "admin-9");
    expect(await verifySessionToken(impersonated)).toEqual({
      memberId: "member-1",
      impersonatorId: "admin-9",
      tokenVersion: 3,
    });

    expect(await verifySessionToken("garbage")).toBeNull();
  });

  it("impersonation tokens are short-lived (≤ 1 hour), regular ones are not", async () => {
    const impersonated = decodeJwt(await createToken("m", 0, "admin"));
    expect(impersonated.exp! - impersonated.iat!).toBeLessThanOrEqual(60 * 60);

    const regular = decodeJwt(await createToken("m", 0));
    expect(regular.exp! - regular.iat!).toBeGreaterThan(24 * 60 * 60);
  });

  it("bumping tokenVersion revokes previously issued tokens (password change)", async () => {
    const { parents } = await makeFamily({ parents: 1, kids: 0 });
    const member = parents[0];

    const token = await createToken(member.id, member.tokenVersion);
    const before = await getApiMember(bearerRequest(token));
    expect(before?.id).toBe(member.id);

    // Simulate a password change/reset
    await db.member.update({
      where: { id: member.id },
      data: { tokenVersion: { increment: 1 } },
    });

    expect(await getApiMember(bearerRequest(token))).toBeNull(); // old session dead

    const fresh = await createToken(member.id, member.tokenVersion + 1);
    expect((await getApiMember(bearerRequest(fresh)))?.id).toBe(member.id);
  });
});

describe("durable login lockout", () => {
  it("locks after too many consecutive failures, and a success resets it", async () => {
    const { db: dbClient } = await import("@/lib/db");
    const { isLockedOut, recordFailedLogin, clearFailedLogins } = await import("@/lib/auth");
    const { parents } = await makeFamily({ parents: 1, kids: 0 });
    const id = parents[0].id;

    const fresh = () => dbClient.member.findUniqueOrThrow({ where: { id } });
    expect(isLockedOut(await fresh())).toBe(false);

    for (let i = 0; i < 10; i++) await recordFailedLogin(id);
    const locked = await fresh();
    expect(locked.failedLogins).toBe(10);
    expect(isLockedOut(locked)).toBe(true);

    await clearFailedLogins(id);
    const reset = await fresh();
    expect(reset.failedLogins).toBe(0);
    expect(isLockedOut(reset)).toBe(false);
  });
});

describe("password reset tokens (forgot password)", () => {
  it("round-trips: create → peek → consume, and is single-use", async () => {
    const { parents } = await makeFamily({ parents: 1, kids: 0 });
    const raw = await createResetToken(parents[0].id);

    expect(await peekResetToken(raw)).toBe(parents[0].id);
    expect(await consumeResetToken(raw)).toBe(parents[0].id);
    expect(await consumeResetToken(raw)).toBeNull(); // single-use
  });

  it("rejects expired tokens", async () => {
    const { parents } = await makeFamily({ parents: 1, kids: 0 });
    const raw = await createResetToken(parents[0].id);
    await db.passwordResetToken.updateMany({
      where: { memberId: parents[0].id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await peekResetToken(raw)).toBeNull();
  });
});
