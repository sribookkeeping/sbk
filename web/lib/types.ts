// String constants shared across the app (SQLite has no native enums).
// These mirror the iOS app's enums in SriBookKeeping/Models.

export const Role = {
  PARENT: "PARENT",
  GUARDIAN: "GUARDIAN",
  GRANDPARENT: "GRANDPARENT",
  CHILD: "CHILD",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_OPTIONS = [
  { value: Role.PARENT, label: "Parent" },
  { value: Role.GUARDIAN, label: "Guardian" },
  { value: Role.GRANDPARENT, label: "Grandparent" },
  { value: Role.CHILD, label: "Child" },
] as const;

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? "Member";
}

/** Adults get family-wide visibility; approval authority stays with PARENTs. */
export function isAdultRole(role: string): boolean {
  return role !== Role.CHILD;
}

export const NotificationType = {
  CLAIM_REMINDER: "CLAIM_REMINDER",
  AUTO_ASSIGNED: "AUTO_ASSIGNED",
  EVENT: "EVENT",
  GENERAL: "GENERAL",
} as const;

// Balance-sheet report emails (member preference; default MONTHLY).
export const ReportFrequency = {
  NONE: "NONE",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  HALF_YEARLY: "HALF_YEARLY",
  YEARLY: "YEARLY",
} as const;
export type ReportFrequency = (typeof ReportFrequency)[keyof typeof ReportFrequency];

export const REPORT_FREQUENCY_OPTIONS = [
  { value: ReportFrequency.NONE, label: "Don't email me reports", days: 0 },
  { value: ReportFrequency.DAILY, label: "Daily", days: 1 },
  { value: ReportFrequency.WEEKLY, label: "Weekly", days: 7 },
  { value: ReportFrequency.MONTHLY, label: "Monthly (default)", days: 30 },
  { value: ReportFrequency.QUARTERLY, label: "Quarterly", days: 91 },
  { value: ReportFrequency.HALF_YEARLY, label: "Half-yearly", days: 182 },
  { value: ReportFrequency.YEARLY, label: "Yearly", days: 365 },
] as const;

export function reportFrequencyDays(frequency: string): number {
  return REPORT_FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.days ?? 0;
}

export const ChoreKind = { POOL: "POOL", ONE_TIME: "ONE_TIME" } as const;
export type ChoreKind = (typeof ChoreKind)[keyof typeof ChoreKind];

// How a chore pays: one flat amount, or a rate × hours/days/weeks logged at
// completion. Mutually exclusive, chosen when the chore is created.
export const RateType = {
  FLAT: "FLAT",
  HOURLY: "HOURLY",
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
} as const;
export type RateType = (typeof RateType)[keyof typeof RateType];

export const RATE_OPTIONS: { value: RateType; label: string; hint: string }[] = [
  { value: RateType.FLAT, label: "Flat fee", hint: "One amount for the whole chore." },
  { value: RateType.HOURLY, label: "Per hour", hint: "Log hours when completing; earn rate × hours." },
  { value: RateType.DAILY, label: "Per day", hint: "Log days when completing; earn rate × days." },
  { value: RateType.WEEKLY, label: "Per week", hint: "Log weeks when completing; earn rate × weeks." },
];

/** "/hr", "/day", "/wk" — empty for flat chores. */
export function rateSuffix(rateType?: string | null): string {
  switch (rateType) {
    case RateType.HOURLY: return "/hr";
    case RateType.DAILY: return "/day";
    case RateType.WEEKLY: return "/wk";
    default: return "";
  }
}

/** "hours" | "days" | "weeks" — what the completer logs for a rate chore. */
export function rateUnitNoun(rateType?: string | null): string {
  switch (rateType) {
    case RateType.HOURLY: return "hours";
    case RateType.DAILY: return "days";
    case RateType.WEEKLY: return "weeks";
    default: return "";
  }
}

export const PoolStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  RETIRED: "RETIRED",
} as const;
export type PoolStatus = (typeof PoolStatus)[keyof typeof PoolStatus];

export const AssignmentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const ExtraStatus = {
  NONE: "NONE",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
} as const;
export type ExtraStatus = (typeof ExtraStatus)[keyof typeof ExtraStatus];

export const ApprovalType = {
  POOL_CHORE: "POOL_CHORE",
  SCHEDULE: "SCHEDULE",
  EXTRA_PAY: "EXTRA_PAY",
  CHORE_EDIT: "CHORE_EDIT",     // both parents
  CHORE_DELETE: "CHORE_DELETE", // both parents
  ASSIGNMENT_SKIP: "ASSIGNMENT_SKIP", // any one parent (skip or reschedule)
} as const;
export type ApprovalType = (typeof ApprovalType)[keyof typeof ApprovalType];

export const ApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export const ScheduleStatus = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
} as const;
export type ScheduleStatus = (typeof ScheduleStatus)[keyof typeof ScheduleStatus];

export const Recurrence = {
  DAILY: "DAILY",
  WEEKLY: "WEEKLY",
  MONTHLY: "MONTHLY",
} as const;
export type Recurrence = (typeof Recurrence)[keyof typeof Recurrence];

export const EXPENSE_CATEGORIES = [
  { value: "FOOD", label: "Food", emoji: "🍽️" },
  { value: "CLOTHING", label: "Clothing", emoji: "👕" },
  { value: "SCHOOL", label: "School", emoji: "🎒" },
  { value: "ENTERTAINMENT", label: "Entertainment", emoji: "🎮" },
  { value: "TOYS", label: "Toys", emoji: "🧸" },
  { value: "OTHER", label: "Other", emoji: "🛍️" },
] as const;

export function categoryInfo(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value) ?? EXPENSE_CATEGORIES[5];
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // index = weekday - 1
