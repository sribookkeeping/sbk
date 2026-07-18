import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { buttonPrimary, buttonSecondary, Tile } from "@/components/ui";
import { BrandLockup } from "@/components/brand";
import {
  IconArrowUpRight,
  IconChart,
  IconCheckCircle,
  IconGrid,
  IconListChecks,
  IconReceipt,
  IconZap,
} from "@/components/icons";
import { InstallButton } from "@/components/install-button";

const FEATURES = [
  { icon: <IconListChecks className="h-4 w-4 text-indigo-400" />, label: "Chore pool" },
  { icon: <IconCheckCircle className="h-4 w-4 text-emerald-400" />, label: "Dual approvals" },
  { icon: <IconArrowUpRight className="h-4 w-4 text-amber-400" />, label: "Extra pay" },
  { icon: <IconReceipt className="h-4 w-4 text-red-400" />, label: "Receipts required" },
  { icon: <IconChart className="h-4 w-4 text-indigo-400" />, label: "Live balances" },
  { icon: <IconGrid className="h-4 w-4 text-slate-400" />, label: "iPhone + web" },
];

/** Static preview of the signed-in dashboard, built from the same primitives. */
function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900 p-4 shadow-2xl shadow-indigo-950/40">
      <div className="flex gap-2.5">
        <div className="flex-1 rounded-xl bg-slate-950/70 p-3">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            My balance
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums">$23.50</p>
        </div>
        <div className="flex-1 rounded-xl bg-slate-950/70 p-3">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            Earned
          </p>
          <p className="mt-0.5 text-lg font-bold text-emerald-400 tabular-nums">$41.00</p>
        </div>
        <div className="flex-1 rounded-xl bg-slate-950/70 p-3">
          <p className="text-[9px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
            To approve
          </p>
          <p className="mt-0.5 text-lg font-bold text-amber-400 tabular-nums">2</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5 rounded-xl bg-slate-950/70 p-3">
        <Tile tone="indigo" size={32}>
          <IconListChecks className="h-4 w-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Feed the dog</p>
          <p className="text-xs text-slate-500">Due today, 6:00 pm</p>
        </div>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">$2.00</span>
        <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
          Complete
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-slate-950/70 p-3">
        <Tile tone="amber" size={32}>
          <IconZap className="h-4 w-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Mow the lawn</p>
          <p className="text-xs text-slate-500">Up for grabs · first to claim</p>
        </div>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">$10.00</span>
        <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950">
          Claim
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-slate-950/70 p-3 opacity-75">
        <Tile tone="emerald" size={32}>
          <IconArrowUpRight className="h-4 w-4" />
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Do the dishes</p>
          <p className="text-xs text-slate-500">Arjun · completed</p>
        </div>
        <span className="text-sm font-bold text-emerald-400 tabular-nums">+$3.00</span>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const member = await getCurrentMember();
  if (member) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <nav className="flex items-center justify-between py-5">
        <BrandLockup size={30} />
        <Link href="/login" className={buttonSecondary}>
          Sign in
        </Link>
      </nav>

      <div className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-14 lg:py-16">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Chores in.
            <br />
            Allowance out.
            <br />
            <span className="text-indigo-400">All on the books.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-600 dark:text-slate-300">
            A real ledger for your family — chores with dollar amounts, parent
            approvals, receipts on every expense, and live balances for everyone.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className={buttonPrimary}>
              Set up your family
            </Link>
            <InstallButton />
          </div>
        </div>

        <DashboardPreview />
      </div>

      <div className="mb-14 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/5 pt-6">
        {FEATURES.map((feature) => (
          <span
            key={feature.label}
            className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          >
            {feature.icon}
            {feature.label}
          </span>
        ))}
      </div>
    </main>
  );
}
