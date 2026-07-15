import { db } from "@/lib/db";
import { parseIds } from "@/lib/approvals";

// Family brainstorming events: one group chat per event, optional excluded
// members (surprise planning). Excluded members must never see the event, its
// chat, or its linked chores — every query in the app goes through these
// helpers to enforce that.

type EventLite = { excludedIds: string; revealedAt?: Date | null };

/** Once revealed, the event (chat, chores, history) is visible to everyone —
 * previously excluded members and members added later alike. */
export function isExcludedFrom(event: EventLite, memberId: string): boolean {
  if (event.revealedAt) return false;
  return parseIds(event.excludedIds).includes(memberId);
}

/** True when a chore is hidden from `memberId` because of its event. */
export function choreHiddenFrom(
  chore: { event?: EventLite | null },
  memberId: string,
): boolean {
  return chore.event != null && isExcludedFrom(chore.event, memberId);
}

/** Events visible to a member (excluded ones are filtered out entirely). */
export async function visibleEvents(familyId: string, memberId: string) {
  const events = await db.event.findMany({
    where: { familyId },
    include: { createdBy: true, chores: true, messages: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });
  return events.filter((e) => !isExcludedFrom(e, memberId));
}

/** One event with chat + linked chores, or null if hidden from the member. */
export async function eventForMember(eventId: string, member: { id: string; familyId: string }) {
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: {
      createdBy: true,
      chores: { include: { assignments: { include: { assignee: true } } } },
      messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!event || event.familyId !== member.familyId) return null;
  if (isExcludedFrom(event, member.id)) return null;
  return event;
}
