"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconHome,
  IconListChecks,
  IconCalendar,
  IconCheckCircle,
  IconReceipt,
  IconGift,
  IconChart,
  IconUsers,
  IconClipboard,
  IconShield,
  IconGrid,
  IconBell,
} from "./icons";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  /** extra path prefixes that should light this item up */
  matches?: string[];
};

const ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  home: IconHome,
  chores: IconListChecks,
  schedules: IconCalendar,
  approvals: IconCheckCircle,
  expenses: IconReceipt,
  events: IconGift,
  reports: IconChart,
  family: IconUsers,
  audit: IconClipboard,
  admin: IconShield,
  more: IconGrid,
  notifications: IconBell,
};

function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = [item.href, ...(item.matches ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = ICONS[item.icon] ?? IconGrid;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              active
                ? "bg-white/[0.06] text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`}
            />
            {item.label}
            {item.badge ? (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal top navigation (desktop) — metrics-band layout. */
export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = ICONS[item.icon] ?? IconGrid;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium ${
              active
                ? "bg-white/[0.07] text-white"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-indigo-400" : "text-slate-500"}`} />
            {item.label}
            {item.badge ? (
              <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar (hidden on lg+, where the top nav takes over). */
export function TabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-slate-950/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const Icon = ICONS[item.icon] ?? IconGrid;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-semibold ${
                active ? "text-indigo-400" : "text-slate-500"
              }`}
            >
              <span className="relative">
                <Icon className="h-[22px] w-[22px]" />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
