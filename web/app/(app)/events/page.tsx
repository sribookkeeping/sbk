import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { visibleEvents } from "@/lib/events";
import { parseIds } from "@/lib/approvals";
import { fmtDate } from "@/lib/format";
import { Badge, buttonPrimary, Card, EmptyState } from "@/components/ui";

export default async function EventsPage() {
  const member = await requireMember();
  const events = await visibleEvents(member.familyId, member.id);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link href="/events/new" className={buttonPrimary}>
          + New Event
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Brainstorm together — each event has its own group chat and linked chores. Surprise
        planning? Exclude the guest of honor and they&apos;ll never see it. 🤫
      </p>

      <Card className="mt-5">
        {events.length === 0 && (
          <EmptyState>No events yet — start planning something fun!</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {events.map((event) => {
            const secretCount = parseIds(event.excludedIds).length;
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-black/2 dark:hover:bg-white/5"
                >
                  <div>
                    <p className="font-medium">🎉 {event.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {event.eventDate ? `${fmtDate(event.eventDate)} · ` : ""}
                      {event.messages.length} message{event.messages.length === 1 ? "" : "s"} ·{" "}
                      {event.chores.length} chore{event.chores.length === 1 ? "" : "s"} · started by{" "}
                      {event.createdBy?.name ?? "someone"}
                    </p>
                  </div>
                  {secretCount > 0 && <Badge color="indigo">🤫 Surprise</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
