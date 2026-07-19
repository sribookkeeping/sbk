import { getApiMember, type SessionMember } from "@/lib/auth";

// Helpers for the /api/v1 REST endpoints consumed by the iOS app.
// Authentication: `Authorization: Bearer <token>` from POST /api/v1/auth/login
// (the web session cookie also works, which makes browser testing easy).

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function apiError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

type Handler<T> = (member: SessionMember, request: Request, context: T) => Promise<Response>;

/** Wraps a route handler with bearer/cookie auth. */
export function withAuth<T = unknown>(handler: Handler<T>) {
  return async (request: Request, context: T): Promise<Response> => {
    const member = await getApiMember(request);
    if (!member) return apiError("Unauthorized", 401);
    try {
      return await handler(member, request, context);
    } catch (error) {
      console.error("API error:", error);
      return apiError("Internal error", 500);
    }
  };
}

// Serializers — money stays integer cents, dates are ISO 8601 strings.

export function serializeMember(m: {
  id: string;
  name: string;
  role: string;
  isHead: boolean;
  emoji: string;
  email: string | null;
  isPlatformAdmin?: boolean;
  reportFrequency?: string;
  mustChangePassword?: boolean;
  deactivatedAt?: Date | null;
}) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    isHead: m.isHead,
    emoji: m.emoji,
    email: m.email,
    isPlatformAdmin: m.isPlatformAdmin ?? false,
    reportFrequency: m.reportFrequency ?? "MONTHLY",
    mustChangePassword: m.mustChangePassword ?? false,
    active: !m.deactivatedAt,
  };
}

export function serializeChore(c: {
  id: string;
  title: string;
  details: string;
  amountCents: number;
  kind: string;
  poolStatus: string;
  createdById: string | null;
  createdAt: Date;
}) {
  return {
    id: c.id,
    title: c.title,
    details: c.details,
    amountCents: c.amountCents,
    kind: c.kind,
    poolStatus: c.poolStatus,
    createdById: c.createdById,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeAssignment(a: {
  id: string;
  choreId: string;
  assigneeId: string | null; // null = unclaimed occurrence of an open schedule
  assignedById: string | null;
  scheduleId?: string | null;
  dueDate: Date | null;
  reminderHour: number;
  status: string;
  completedAt: Date | null;
  baseAmountCents: number;
  extraAmountCents: number;
  extraReason: string;
  extraStatus: string;
  autoAssigned?: boolean;
}) {
  return {
    id: a.id,
    choreId: a.choreId,
    assigneeId: a.assigneeId,
    assignedById: a.assignedById,
    scheduleId: a.scheduleId ?? null,
    dueDate: a.dueDate?.toISOString() ?? null,
    reminderHour: a.reminderHour,
    status: a.status,
    completedAt: a.completedAt?.toISOString() ?? null,
    baseAmountCents: a.baseAmountCents,
    extraAmountCents: a.extraAmountCents,
    extraReason: a.extraReason,
    extraStatus: a.extraStatus,
    autoAssigned: a.autoAssigned ?? false,
  };
}
