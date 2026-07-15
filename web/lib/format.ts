// Money is stored as integer cents everywhere.

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
});

export function fmtMoney(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

/** Parses user input like "12", "12.5", "$12.50" into cents; null if invalid. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function hourLabel(hour: number): string {
  if (hour < 0) return "—";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate || status !== "PENDING") return false;
  return dueDate < startOfDay(new Date());
}

// MARK: date-input parsing (avoid the UTC-midnight trap)

/**
 * Parses an <input type="date"> value ("YYYY-MM-DD") as LOCAL noon — plain
 * `new Date("YYYY-MM-DD")` parses as UTC midnight, which renders as the
 * previous day in western timezones.
 */
export function parseDateInput(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return raw ? new Date(raw) : null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

/** Formats a Date as a local "YYYY-MM-DD" for <input type="date"> defaults. */
export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// MARK: timezone-aware date math (schedules run in the FAMILY's timezone,
// not the server's — a Vercel server runs in UTC).

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    });
    zoneFormatters.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAY_NUMBER: Record<string, number> = {
  Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
};

export type ZonedParts = {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  weekday: number; // 1 = Sunday … 7 = Saturday
};

/** The wall-clock parts of an instant in the given IANA timezone. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: WEEKDAY_NUMBER[parts.weekday] ?? 1,
  };
}

/** The UTC instant of a wall-clock time in the given timezone (2-pass DST-safe). */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1–12; day may overflow, Date.UTC normalizes
  day: number,
  hour: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour);
  const desired = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour);
    guess += desired - wall;
  }
  return new Date(guess);
}

/** Midnight (start of day) of the instant's date in the given timezone. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, timeZone);
}

/** Start of the day N days after the instant's date, in the given timezone. */
export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  return zonedTimeToUtc(p.year, p.month, p.day + days, 0, timeZone);
}

/** The server's own IANA timezone (fallback when a family has none). */
export function serverZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** True when `timeZone` is a valid IANA identifier. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
