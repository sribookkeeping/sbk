import { fmtMoney } from "@/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-black/8 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  orange: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  gray: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

export function Badge({ color = "gray", children }: { color?: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}
    >
      {children}
    </span>
  );
}

export function Avatar({
  emoji,
  isParent,
  size = 40,
}: {
  emoji: string;
  isParent: boolean;
  size?: number;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${
        isParent ? "bg-indigo-100 dark:bg-indigo-950" : "bg-amber-100 dark:bg-amber-950"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {emoji}
    </span>
  );
}

export function Money({
  cents,
  tone = "auto",
  className = "",
}: {
  cents: number;
  tone?: "auto" | "plain" | "positive" | "negative";
  className?: string;
}) {
  const color =
    tone === "plain"
      ? ""
      : tone === "positive" || (tone === "auto" && cents >= 0)
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-red-600 dark:text-red-400";
  return (
    <span className={`font-bold tabular-nums ${color} ${className}`}>{fmtMoney(cents)}</span>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{children}</p>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
      {children}
    </h2>
  );
}

export const inputClass =
  "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-slate-900";

export const buttonPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50";

export const buttonSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10";

export const buttonDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950";
