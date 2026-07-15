"use client";

import { useState } from "react";

type DueMode = "none" | "once" | "schedule";

const OPTIONS: { value: DueMode; emoji: string; title: string; hint: string }[] = [
  {
    value: "none",
    emoji: "🕰️",
    title: "No due date",
    hint: "The chore stays open until someone completes it.",
  },
  {
    value: "once",
    emoji: "📌",
    title: "One due date",
    hint: "Due once, on the date and time you pick.",
  },
  {
    value: "schedule",
    emoji: "📅",
    title: "On a schedule",
    hint: "Repeats daily, weekly, or monthly. Needs approval from both parents.",
  },
];

/**
 * "When is it due?" — exactly one of: no due date, a single due date, or a
 * recurring schedule. The fields for the selected mode render below the radios;
 * unselected modes' fields are unmounted so they never submit.
 */
export function DueModeFields({
  defaultMode = "once",
  onceFields,
  scheduleFields,
}: {
  defaultMode?: DueMode;
  onceFields: React.ReactNode;
  scheduleFields: React.ReactNode;
}) {
  const [mode, setMode] = useState<DueMode>(defaultMode);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">When is it due?</legend>
      <div className="space-y-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-3 py-3 has-checked:border-emerald-500 has-checked:bg-emerald-50 dark:border-white/15 dark:has-checked:bg-emerald-950"
          >
            <input
              type="radio"
              name="dueMode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 size-4 accent-emerald-600"
            />
            <span>
              <span className="block text-sm font-medium">
                {option.emoji} {option.title}
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {mode === "once" && <div className="mt-4">{onceFields}</div>}
      {mode === "schedule" && <div className="mt-4">{scheduleFields}</div>}
    </fieldset>
  );
}
