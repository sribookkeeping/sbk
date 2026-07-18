"use client";

import { useEffect } from "react";

/** Registers the service worker so the app is installable + offline-aware. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Skip in local dev: dev asset URLs aren't content-hashed, so the
    // cache-first worker would serve stale CSS/JS across code changes.
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") return;
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Register after load so it never competes with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
