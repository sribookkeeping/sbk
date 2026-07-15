import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { impersonate } from "@/lib/actions/admin";
import { auditLabel } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/types";
import { Avatar, Badge, Card, ErrorBanner, SectionTitle } from "@/components/ui";

/**
 * Platform admin console: every family and member, one-click impersonation
 * (audited), and the latest activity across families.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await requireAdmin();
  const { error } = await searchParams;

  const [families, recent] = await Promise.all([
    db.family.findMany({
      include: { members: true },
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const familyName = new Map(families.map((f) => [f.id, f.name]));

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Admin</h1>
        <Badge color="red">admin: {admin.name}</Badge>
      </div>
      <div className="mt-4">
        <ErrorBanner message={error} />
      </div>

      <SectionTitle>Families ({families.length})</SectionTitle>
      {families.map((family) => (
        <Card key={family.id} className="mb-4">
          <p className="font-semibold">
            {family.name}{" "}
            <span className="text-xs font-normal text-zinc-400">
              · {family.members.length} members · created {fmtDateTime(family.createdAt)}
            </span>
          </p>
          <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10">
            {family.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2 text-sm">
                  <Avatar emoji={m.emoji} isParent={m.role === "PARENT"} size={28} />
                  <span className="font-medium">
                    {m.name} {m.isHead && "👑"} {m.isPlatformAdmin && "🛡️"}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {roleLabel(m.role)}
                    {m.email ? ` · ${m.email}` : ""}
                  </span>
                </span>
                {m.id !== admin.id && (
                  <form action={impersonate.bind(null, m.id)}>
                    <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
                      Impersonate
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <SectionTitle>Recent activity (all families)</SectionTitle>
      <Card>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {recent.map((entry) => (
            <li key={entry.id} className="py-2 text-sm">
              <span className="font-medium">{auditLabel(entry.action)}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {" "}
                · {entry.actorName || "System"} · {familyName.get(entry.familyId) ?? "?"} ·{" "}
                {fmtDateTime(entry.createdAt)}
                {entry.impersonatorId && " · via admin"}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
