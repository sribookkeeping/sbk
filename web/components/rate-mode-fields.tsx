"use client";

import { useState } from "react";
import { RATE_OPTIONS, RateType } from "@/lib/types";
import { inputClass } from "@/components/ui";

/**
 * "How does it pay?" — exactly one of: flat fee, per hour, per day, per week.
 * The amount field's meaning follows the selection (whole payment vs. rate).
 */
export function RateModeFields() {
  const [rateType, setRateType] = useState<string>(RateType.FLAT);

  const amountLabel =
    rateType === RateType.FLAT
      ? "Amount ($)"
      : rateType === RateType.HOURLY
        ? "Rate ($ per hour)"
        : rateType === RateType.DAILY
          ? "Rate ($ per day)"
          : "Rate ($ per week)";

  return (
    <>
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">How does it pay?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RATE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                rateType === option.value
                  ? "border-indigo-500/60 bg-indigo-50 dark:bg-indigo-950/40"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              <input
                type="radio"
                name="rateType"
                value={option.value}
                checked={rateType === option.value}
                onChange={() => setRateType(option.value)}
                className="mt-0.5 size-4 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="amount">
          {amountLabel}
        </label>
        <input
          id="amount"
          name="amount"
          required
          inputMode="decimal"
          placeholder="5.00"
          className={inputClass}
        />
      </div>
    </>
  );
}
