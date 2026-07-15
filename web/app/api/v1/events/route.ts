import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { joinIds, parseIds } from "@/lib/approvals";
import { visibleEvents } from "@/lib/events";
import { notifyFamily } from "@/lib/notifications";
import { NotificationType } from "@/lib/types";
import { apiError, json, withAuth } from "@/lib/api";

/** GET → events visible to the caller (excluded members never see theirs). */
export const GET = withAuth(async (member) => {
  const events = await visibleEvents(member.familyId, member.id);
  return json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      details: e.details,
      eventDate: e.eventDate?.toISOString() ?? null,
      excludedMemberIds: parseIds(e.excludedIds),
      revealedAt: e.revealedAt?.toISOString() ?? null,
      createdBy: e.createdBy ? { id: e.createdBy.id, name: e.createdBy.name } : null,
      messageCount: e.messages.length,
      choreCount: e.chores.length,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

/** POST { title, details?, eventDate?, excludedMemberIds? } */
export const POST = withAuth(async (member, request) => {
  let body: {
    title?: string;
    details?: string;
    eventDate?: string;
    excludedMemberIds?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", 400);
  }

  const title = (body.title ?? "").trim();
  if (!title) return apiError("title is required", 400);

  const excludeIds = Array.isArray(body.excludedMemberIds) ? body.excludedMemberIds : [];
  const validExcluded = member.family.members
    .filter((m) => excludeIds.includes(m.id))
    .map((m) => m.id);
  if (validExcluded.includes(member.id)) {
    return apiError("You can't exclude yourself from your own event", 400);
  }
  if (validExcluded.length >= member.family.members.length) {
    return apiError("At least one member must be part of the event", 400);
  }

  const event = await db.event.create({
    data: {
      familyId: member.familyId,
      title,
      details: (body.details ?? "").trim(),
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      excludedIds: joinIds(validExcluded),
      createdById: member.id,
    },
  });

  await notifyFamily(
    member.familyId,
    NotificationType.EVENT,
    "New event planning! 🎉",
    `${member.name} started planning "${title}" — join the chat!`,
    undefined,
    [...validExcluded, member.id],
  );

  await audit(member, AuditAction.EVENT_CREATED, "Event", event.id, {
    title,
    excludedCount: validExcluded.length,
  });
  return json({ event: { id: event.id, title: event.title } }, 201);
});
