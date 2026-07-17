import Link from "next/link";
import { requireMember, isParent, isPlatformAdmin } from "@/lib/auth";
import { stopImpersonating } from "@/lib/actions/admin";
import { canDecide } from "@/lib/approvals";
import { db } from "@/lib/db";
import { logout } from "@/lib/actions/auth";
import { runScheduleSweep } from "@/lib/schedules";
import { sendDueReports } from "@/lib/reports";
import { unreadCount } from "@/lib/notifications";
import { ApprovalStatus } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { NavLinks } from "@/components/nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();

  // Materialize schedule occurrences + claim reminders + auto-assignment,
  // then any balance-sheet report emails that are due. Both idempotent; in
  // the cloud a cron also runs these (see README).
  await runScheduleSweep(member.familyId);
  await sendDueReports(member.familyId);

  const [pending, unread] = await Promise.all([
    db.approvalRequest.findMany({
      where: { familyId: member.familyId, status: ApprovalStatus.PENDING },
    }),
    unreadCount(member.id),
  ]);
  const badge = pending.filter((request) => canDecide(request, member)).length;

  const items = [
    { href: "/dashboard", label: "Home", emoji: "🏠" },
    { href: "/chores", label: "Chores", emoji: "🧹" },
    { href: "/schedules", label: "Schedules", emoji: "📅" },
    { href: "/approvals", label: "Approvals", emoji: "✅", badge },
    { href: "/expenses", label: "Expenses", emoji: "🧾" },
    { href: "/events", label: "Events", emoji: "🎉" },
    { href: "/reports", label: "Reports", emoji: "📈" },
    { href: "/family", label: "Family", emoji: "👨‍👩‍👧‍👦" },
    ...(isParent(member) ? [{ href: "/audit", label: "Audit", emoji: "📋" }] : []),
    ...(isPlatformAdmin(member) ? [{ href: "/admin", label: "Admin", emoji: "🛡️" }] : []),
  ];

  return (
    <>
      {member.impersonatorId && (
        <div className="flex items-center justify-center gap-3 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white">
          🛡️ Admin: viewing as {member.name}
          <form action={stopImpersonating}>
            <button className="rounded-full bg-white/20 px-3 py-0.5 text-xs hover:bg-white/30">
              Return to admin
            </button>
          </form>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-black/8 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="text-xl">🏡</span>
            <span className="hidden sm:inline">SriBookKeeping</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="relative rounded-lg px-2 py-1 text-lg hover:bg-black/5 dark:hover:bg-white/10"
              title="Notifications"
            >
              🔔
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <span className="flex items-center gap-2 text-sm">
              <Avatar emoji={member.emoji} isParent={member.role === "PARENT"} size={30} />
              <span className="hidden font-medium sm:inline">{member.name}</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2">
          <NavLinks items={items} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-black/8 py-4 text-center text-xs text-slate-400 dark:border-white/10">
        {member.family.name} · SriBookKeeping
      </footer>
    </>
  );
}
