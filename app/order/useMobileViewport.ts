"use client";

import { useEffect, useState } from "react";

export function useMobileViewport(maxWidth = 767) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [maxWidth]);

  return isMobile;
}

export function readInitialStickyPanelOpen() {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 768;
}
