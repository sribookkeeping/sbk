"use client";

import { useEffect, useState } from "react";

/**
 * Hidden input that captures the browser's IANA timezone at registration, so
 * schedule reminders fire in the family's day — not the server's (UTC on
 * Vercel).
 */
export function TimezoneField() {
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  }, []);

  return <input type="hidden" name="timezone" value={timezone} />;
}
