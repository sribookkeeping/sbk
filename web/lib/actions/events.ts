"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { joinIds } from "@/lib/approvals";
import { eventForMember } from "@/lib/events";
import { notifyFamily } from "@/lib/notifications";
import { audit, AuditAction } from "@/lib/audit";
import { isParent } from "@/lib/auth";
import { parseIds } from "@/lib/approvals";
import { NotificationType } from "@/lib/types";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/**
 * Create a brainstorming event with its own group chat. Excluded members
 * (e.g. the birthday person) never see it.
 */
export async function createEvent(formData: FormData) {
  const member = await requireMember();

  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const dateRaw = String(formData.get("eventDate") ?? "");
  const excludeIds = formData.getAll("exclude").map(String);

  if (!title) fail("/events/new", "Give the event a title.");
  const validExcluded = member.family.members
    .filter((m) => excludeIds.includes(m.id))
    .map((m) => m.id);
  if (validExcluded.includes(member.id)) {
    fail("/events/new", "You can't exclude yourself from your own event.");
  }
  if (validExcluded.length >= member.family.members.length) {
    fail("/events/new", "At least one member must be part of the event.");
  }

  const event = await db.event.create({
    data: {
      familyId: member.familyId,
      title,
      details,
      eventDate: dateRaw ? new Date(dateRaw) : null,
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
    [...validExcluded, member.id], // don't notify excluded members or the creator
  );

  await audit(member, AuditAction.EVENT_CREATED, "Event", event.id, {
    title,
    excludedCount: validExcluded.length,
  });
  revalidatePath("/events");
  redirect(`/events/${event.id}`);
}

/**
 * Reveal the surprise: from now on the WHOLE event (chat, chores, history) is
 * visible to everyone — previously excluded members and members added later.
 * The creator or any parent can reveal.
 */
export async function revealEvent(eventId: string) {
  const member = await requireMember();

  const event = await eventForMember(eventId, member);
  if (!event || event.revealedAt) return;
  if (event.createdById !== member.id && !isParent(member)) return;

  await db.event.update({ where: { id: eventId }, data: { revealedAt: new Date() } });
  await audit(member, AuditAction.EVENT_REVEALED, "Event", eventId, { title: event.title });

  const excludedIds = parseIds(event.excludedIds);
  if (excludedIds.length > 0) {
    await notifyFamily(
      member.familyId,
      NotificationType.EVENT,
      "Surprise revealed! 🎊",
      `The planning for "${event.title}" is now visible to everyone.`,
    );
  }
  revalidatePath("/", "layout");
  redirect(`/events/${eventId}`);
}

/** Post a message in an event's group chat. */
export async function postMessage(eventId: string, formData: FormData) {
  const member = await requireMember();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect(`/events/${eventId}`);

  const event = await eventForMember(eventId, member);
  if (!event) redirect("/events");

  await db.message.create({
    data: { eventId, authorId: member.id, body: body.slice(0, 2000) },
  });
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}`);
}
