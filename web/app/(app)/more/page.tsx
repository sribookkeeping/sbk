import Link from "next/link";
import { requireMember, isParent, isPlatformAdmin } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { unreadCount } from "@/lib/notifications";
import { Avatar, Card } from "@/components/ui";
import {
  IconBell,
  IconCalendar,
  IconChart,
  IconChevronRight,
  IconClipboard,
  IconGift,
  IconLogout,
  IconShield,
  IconUsers,
} from "@/components/icons";

export default async function MorePage() {
  const member = await requireMember();
  const unread = await unreadCount(member.id);

  const entries = [
    { href: "/schedules", label: "Schedules", icon: <IconCalendar className="h-5 w-5" /> },
    { href: "/events", label: "Events", icon: <IconGift className="h-5 w-5" /> },
    { href: "/reports", label: "Reports", icon: <IconChart className="h-5 w-5" /> },
    { href: "/family", label: "Family", icon: <IconUsers className="h-5 w-5" /> },
    {
      href: "/notifications",
      label: "Notifications",
      icon: <IconBell className="h-5 w-5" />,
      badge: unread,
    },
    ...(isParent(member)
      ? [{ href: "/audit", label: "Audit log", icon: <IconClipboard className="h-5 w-5" /> }]
      : []),
    ...(isPlatformAdmin(member)
      ? [{ href: "/admin", label: "Platform admin", icon: <IconShield className="h-5 w-5" /> }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <div className="flex items-center gap-3">
          <Avatar emoji={member.emoji} isParent={member.role === "PARENT"} size={48} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{member.name}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">
              {member.family.name}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-4 !p-2">
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {entries.map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="flex items-center gap-3 rounded-xl px-3 py-3.5 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="text-slate-500 dark:text-slate-400">{entry.icon}</span>
                <span className="flex-1 text-sm font-medium">{entry.label}</span>
                {entry.badge ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
                    {entry.badge}
                  </span>
                ) : null}
                <IconChevronRight className="h-4 w-4 text-slate-600" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <form action={logout} className="mt-4">
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-950/40"
        >
          <IconLogout className="h-4.5 w-4.5" />
          Sign out
        </button>
      </form>
    </div>
  );
}
