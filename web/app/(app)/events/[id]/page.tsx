import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { eventForMember } from "@/lib/events";
import { postMessage, revealEvent } from "@/lib/actions/events";
import { isParent } from "@/lib/auth";
import { parseIds } from "@/lib/approvals";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { AssignmentStatus } from "@/lib/types";
import {
  Avatar,
  Badge,
  buttonPrimary,
  buttonSecondary,
  Card,
  EmptyState,
  inputClass,
  Money,
  SectionTitle,
} from "@/components/ui";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember();
  const { id } = await params;

  const event = await eventForMember(id, member);
  if (!event) notFound();

  const excluded = member.family.members.filter((m) =>
    parseIds(event.excludedIds).includes(m.id),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {event.eventDate ? `${fmtDate(event.eventDate)} · ` : ""}
            started by {event.createdBy?.name ?? "someone"}
          </p>
        </div>
        {event.revealedAt ? (
          <Badge color="green">Revealed — visible to everyone</Badge>
        ) : excluded.length > 0 ? (
          <Badge color="indigo">
            Secret from {excluded.map((m) => m.name).join(", ")}
          </Badge>
        ) : null}
      </div>
      {event.details && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{event.details}</p>
      )}

      {!event.revealedAt &&
        excluded.length > 0 &&
        (event.createdById === member.id || isParent(member)) && (
          <form action={revealEvent.bind(null, event.id)} className="mt-3">
            <button className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              Reveal the surprise — make everything visible to everyone
            </button>
          </form>
        )}

      <SectionTitle>Event chores ({event.chores.length})</SectionTitle>
      <Card>
        {event.chores.length === 0 && (
          <EmptyState>No chores linked yet — break the plan into tasks!</EmptyState>
        )}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {event.chores.map((chore) => {
            const open = chore.assignments.filter((a) => a.status === AssignmentStatus.PENDING);
            const done = chore.assignments.filter((a) => a.status === AssignmentStatus.COMPLETED);
            const who = [...new Set(chore.assignments.map((a) => a.assignee?.name ?? "unclaimed"))];
            return (
              <li key={chore.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{chore.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {who.length > 0 ? who.join(", ") : "not assigned yet"}
                    {done.length > 0 && ` · ${done.length} done`}
                    {open.length > 0 && ` · ${open.length} open`}
                  </p>
                </div>
                <Money cents={chore.amountCents} tone="positive" />
              </li>
            );
          })}
        </ul>
        <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
          <Link href={`/chores/new?eventId=${event.id}`} className={buttonSecondary}>
            + Add a chore for this event
          </Link>
        </div>
      </Card>

      <SectionTitle>Group chat ({event.messages.length})</SectionTitle>
      <Card>
        {event.messages.length === 0 && (
          <EmptyState>No messages yet — kick off the brainstorm!</EmptyState>
        )}
        <ul className="space-y-3">
          {event.messages.map((message) => {
            const mine = message.authorId === member.id;
            return (
              <li key={message.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {message.author && (
                  <Avatar
                    emoji={message.author.emoji}
                    isParent={message.author.role === "PARENT"}
                    size={30}
                  />
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    mine
                      ? "bg-indigo-600 text-white"
                      : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  <p className={`text-xs font-semibold ${mine ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                    {message.author?.name ?? "Someone"} ·{" "}
                    {fmtDateTime(message.createdAt)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <form action={postMessage.bind(null, event.id)} className="mt-4 flex gap-2">
          <input
            name="body"
            required
            maxLength={2000}
            placeholder="Share an idea…"
            autoComplete="off"
            className={inputClass}
          />
          <button type="submit" className={buttonPrimary}>
            Send
          </button>
        </form>
      </Card>
    </div>
  );
}
