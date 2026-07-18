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
import { BrandLockup } from "@/components/brand";
import { IconBell, IconLogout } from "@/components/icons";
import { SideNav, TabBar, type NavItem } from "@/components/nav-links";

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

  const sideItems: NavItem[] = [
    { href: "/dashboard", label: "Home", icon: "home" },
    { href: "/chores", label: "Chores", icon: "chores", matches: ["/assignments"] },
    { href: "/schedules", label: "Schedules", icon: "schedules" },
    { href: "/approvals", label: "Approvals", icon: "approvals", badge },
    { href: "/expenses", label: "Expenses", icon: "expenses" },
    { href: "/events", label: "Events", icon: "events" },
    { href: "/reports", label: "Reports", icon: "reports" },
    { href: "/family", label: "Family", icon: "family" },
    ...(isParent(member) ? [{ href: "/audit", label: "Audit", icon: "audit" }] : []),
    ...(isPlatformAdmin(member) ? [{ href: "/admin", label: "Admin", icon: "admin" }] : []),
  ];

  const tabItems: NavItem[] = [
    { href: "/dashboard", label: "Home", icon: "home" },
    { href: "/chores", label: "Chores", icon: "chores", matches: ["/assignments"] },
    { href: "/approvals", label: "Approvals", icon: "approvals", badge },
    { href: "/expenses", label: "Expenses", icon: "expenses" },
    {
      href: "/more",
      label: "More",
      icon: "more",
      matches: [
        "/schedules",
        "/events",
        "/reports",
        "/family",
        "/audit",
        "/admin",
        "/notifications",
      ],
    },
  ];

  return (
    <>
      {member.impersonatorId && (
        <div className="flex items-center justify-center gap-3 bg-red-600 px-4 py-1.5 text-sm font-semibold text-white">
          Admin: viewing as {member.name}
          <form action={stopImpersonating}>
            <button className="rounded-full bg-white/20 px-3 py-0.5 text-xs hover:bg-white/30">
              Return to admin
            </button>
          </form>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/5 px-3 py-5 lg:flex">
          <Link href="/dashboard" className="px-3">
            <BrandLockup size={30} />
          </Link>
          <div className="mt-7 flex-1 overflow-y-auto">
            <SideNav items={sideItems} />
          </div>
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center gap-2.5 px-3 py-2">
              <Avatar emoji={member.emoji} isParent={member.role === "PARENT"} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-slate-500">{member.family.name}</p>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                >
                  <IconLogout className="h-4.5 w-4.5" />
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/90 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
              <Link href="/dashboard" className="lg:hidden">
                <BrandLockup size={26} />
              </Link>
              <span className="hidden text-sm text-slate-500 lg:inline">
                {member.family.name}
              </span>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/notifications"
                  className="relative rounded-xl p-2.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  title="Notifications"
                >
                  <IconBell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Link>
                <Link href="/more" className="lg:hidden" title="Account">
                  <Avatar emoji={member.emoji} isParent={member.role === "PARENT"} size={30} />
                </Link>
              </div>
            </div>
          </header>

          <main className="w-full flex-1 px-4 py-6 pb-28 lg:px-8 lg:pb-12">{children}</main>

          <footer className="hidden border-t border-white/5 py-4 text-center text-xs text-slate-600 lg:block">
            {member.family.name} · SriBookKeeping
          </footer>
        </div>
      </div>

      <TabBar items={tabItems} />
    </>
  );
}
