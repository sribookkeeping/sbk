"use client";

import { useEffect, useState } from "react";

// Shows an explicit "Install app" button once the browser signals the PWA is
// installable (Android/Chromium fire `beforeinstallprompt`). On iOS Safari,
// which has no such event, it shows a short "Add to Home Screen" hint instead.

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

export function InstallButton() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // Already running as an installed app? Nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari only
      window.navigator.standalone === true;
    if (standalone) setInstalled(true);

    // iOS Safari can't auto-prompt — detect it to show manual instructions.
    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) {
      setIosHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        type="button"
        onClick={() => deferred.prompt()}
        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
      >
        📲 Install app
      </button>
    );
  }

  if (iosHint) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        📲 To install: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
      </p>
    );
  }

  return null;
}
