import { db } from "@/lib/db";
import { eventForMember } from "@/lib/events";
import { apiError, json, withAuth } from "@/lib/api";

/** GET → the event's group chat (visible members only). */
export const GET = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, _request, { params }) => {
    const { id } = await params;
    const event = await eventForMember(id, member);
    if (!event) return apiError("Event not found", 404);

    return json({
      event: { id: event.id, title: event.title },
      messages: event.messages.map((m) => ({
        id: m.id,
        author: m.author ? { id: m.author.id, name: m.author.name, emoji: m.author.emoji } : null,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  },
);

/** POST { body } → post a message to the event chat. */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;
    const event = await eventForMember(id, member);
    if (!event) return apiError("Event not found", 404);

    let payload: { body?: string };
    try {
      payload = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }
    const body = (payload.body ?? "").trim();
    if (!body) return apiError("body is required", 400);

    const message = await db.message.create({
      data: { eventId: event.id, authorId: member.id, body: body.slice(0, 2000) },
    });
    return json({ message: { id: message.id, createdAt: message.createdAt.toISOString() } }, 201);
  },
);
