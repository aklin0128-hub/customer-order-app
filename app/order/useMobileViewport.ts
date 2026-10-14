"use client";

import { useSyncExternalStore } from "react";

function subscribeMaxWidth(maxWidth: number, onStoreChange: () => void) {
  const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

export function useMobileViewport(maxWidth = 767) {
  return useSyncExternalStore(
    (onStoreChange) => subscribeMaxWidth(maxWidth, onStoreChange),
    () => window.matchMedia(`(max-width: ${maxWidth}px)`).matches,
    () => false
  );
}

export function readInitialStickyPanelOpen() {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 768;
}
