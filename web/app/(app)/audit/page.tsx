import { notFound } from "next/navigation";
import { requireMember, isParent } from "@/lib/auth";
import { familyAudit, auditLabel } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, EmptyState } from "@/components/ui";

/** Every family activity, newest first — for parent review (requirement 11). */
export default async function AuditPage() {
  const member = await requireMember();
  if (!isParent(member)) notFound();

  const entries = await familyAudit(member.familyId);

  return (
    <>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Every activity in {member.family.name}, newest first. Entries marked{" "}
        <Badge color="red">admin</Badge> were performed by a platform admin impersonating the
        member.
      </p>

      <Card className="mt-5">
        {entries.length === 0 && <EmptyState>No activity recorded yet.</EmptyState>}
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {entries.map((entry) => {
            let details: Record<string, unknown> = {};
            try {
              details = JSON.parse(entry.details || "{}");
            } catch {}
            const proofLink =
              entry.action === "ASSIGNMENT_COMPLETED" && entry.entityId
                ? `/api/proofs/${entry.entityId}`
                : null;
            return (
              <li key={entry.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {auditLabel(entry.action)}
                      {entry.impersonatorId && (
                        <span className="ml-2 align-middle">
                          <Badge color="red">admin</Badge>
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {entry.actorName || "System"} · {fmtDateTime(entry.createdAt)} ·{" "}
                      {entry.entityType}
                    </p>
                    {Object.keys(details).length > 0 && (
                      <p className="mt-1 truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        {JSON.stringify(details)}
                      </p>
                    )}
                    {proofLink && (
                      <a
                        href={proofLink}
                        target="_blank"
                        className="mt-1 inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                      >
                        📸 View proof photo
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
