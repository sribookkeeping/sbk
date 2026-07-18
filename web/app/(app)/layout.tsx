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
import { BrandLockup, BrandMark } from "@/components/brand";
import { IconBell, IconLogout } from "@/components/icons";
import { TopNav, TabBar, type NavItem } from "@/components/nav-links";

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

  const navItems: NavItem[] = [
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

      {/* Top bar: brand, horizontal nav (desktop), bell + account */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/dashboard" className="shrink-0">
            <span className="lg:hidden">
              <BrandLockup size={26} />
            </span>
            <span className="hidden lg:inline-flex" title="SriBookKeeping">
              <BrandMark size={30} />
            </span>
          </Link>

          <TopNav items={navItems} />

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
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
            <span className="hidden items-center gap-1 pl-1 lg:flex">
              <Avatar emoji={member.emoji} isParent={member.role === "PARENT"} size={30} />
              <form action={logout}>
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                >
                  <IconLogout className="h-4.5 w-4.5" />
                </button>
              </form>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 lg:px-6 lg:pb-12">
        {children}
      </main>

      <footer className="hidden border-t border-white/5 py-4 text-center text-xs text-slate-600 lg:block">
        {member.family.name} · SriBookKeeping
      </footer>

      <TabBar items={tabItems} />
    </>
  );
}
