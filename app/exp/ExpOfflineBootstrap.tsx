"use client";

import { useEffect } from "react";

/** Registers EXP shell service worker for offline page open on mobile. */
export function ExpOfflineBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/exp-sw.js", { scope: "/exp" }).catch(() => {
      /* ignore — offline shell is best-effort */
    });
  }, []);

  return null;
}
