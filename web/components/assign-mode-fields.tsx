"use client";

import { useState } from "react";

type AssignMode = "assign" | "open";

/**
 * "Who does it?" — mutually exclusive: assign to specific members, or leave it
 * open for anyone in the family to claim. Applies to every chore type; the
 * assignee checkboxes unmount in open mode so they never submit.
 */
export function AssignModeFields({
  defaultMode = "assign",
  assignFields,
}: {
  defaultMode?: AssignMode;
  assignFields: React.ReactNode;
}) {
  const [mode, setMode] = useState<AssignMode>(defaultMode);

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Who does it?</legend>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-3 py-3 has-checked:border-emerald-500 has-checked:bg-emerald-50 dark:border-white/15 dark:has-checked:bg-emerald-950">
          <input
            type="radio"
            name="assignMode"
            value="assign"
            checked={mode === "assign"}
            onChange={() => setMode("assign")}
            className="mt-1 size-4 accent-emerald-600"
          />
          <span>
            <span className="block text-sm font-medium">👤 Assign to specific members</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Pick who is responsible below.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/10 px-3 py-3 has-checked:border-amber-500 has-checked:bg-amber-50 dark:border-white/15 dark:has-checked:bg-amber-950">
          <input
            type="radio"
            name="assignMode"
            value="open"
            checked={mode === "open"}
            onChange={() => setMode("open")}
            className="mt-1 size-4 accent-amber-500"
          />
          <span>
            <span className="block text-sm font-medium">🙋 Open for anyone to claim</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              First to claim it earns it. With a due date, the family is reminded to claim it a
              day ahead — and if nobody does, it&apos;s auto-assigned fairly. Without one, it stays
              up for grabs.
            </span>
          </span>
        </label>
      </div>

      {mode === "assign" && <div className="mt-4">{assignFields}</div>}
    </fieldset>
  );
}
