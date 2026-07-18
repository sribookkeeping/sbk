import { requireMember } from "@/lib/auth";
import { createEvent } from "@/lib/actions/events";
import { Avatar, buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  const { error } = await searchParams;
  const others = member.family.members.filter((m) => m.id !== member.id && !m.deactivatedAt);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">New Event</h1>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <Card className="mt-2">
        <form action={createEvent} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="title">What are we planning?</label>
            <input
              id="title"
              name="title"
              required
              placeholder="Mom's surprise birthday party"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="details">Details (optional)</label>
            <textarea id="details" name="details" rows={3} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="eventDate">Event date (optional)</label>
            <input id="eventDate" name="eventDate" type="date" className={inputClass} />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Keep it secret from…</legend>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Excluded members never see this event, its chat, or its chores — perfect for
              surprises.
            </p>
            <div className="space-y-2">
              {others.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 has-checked:border-indigo-500 has-checked:bg-indigo-50 dark:border-white/15 dark:has-checked:bg-indigo-950"
                >
                  <input
                    type="checkbox"
                    name="exclude"
                    value={m.id}
                    className="size-4 accent-indigo-600"
                  />
                  <Avatar emoji={m.emoji} isParent={m.role === "PARENT"} size={28} />
                  <span className="text-sm font-medium">{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <button type="submit" className={`${buttonPrimary} w-full`}>
            Start Planning
          </button>
        </form>
      </Card>
    </div>
  );
}
