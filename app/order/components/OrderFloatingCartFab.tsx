"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import {
  clampFabPosition,
  defaultFabPosition,
  fabSizeForWidth,
  getViewportBox,
  parseSafeInset,
  safariChromeClearance,
  type FabPosition,
  type SafeInsets,
} from "../floatingCartFabPosition";

const STORAGE_KEY = "order_fab_position_v1";
const DRAG_THRESHOLD_PX = 6;
const TAP_DEDUP_MS = 400;

type Props = {
  count: number;
  label: string;
  hidden?: boolean;
  onClick: () => void;
};

function readSafeInsets(): SafeInsets {
  if (typeof document === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseSafeInset(cs.paddingTop),
    right: parseSafeInset(cs.paddingRight),
    bottom: parseSafeInset(cs.paddingBottom),
    left: parseSafeInset(cs.paddingLeft),
  };
  probe.remove();
  return insets;
}

function liveClamp(pos: FabPosition): FabPosition {
  const viewport = getViewportBox(window);
  const size = fabSizeForWidth(viewport.width);
  const extras = safariChromeClearance(viewport, window.innerHeight);
  return clampFabPosition(pos, {
    size,
    viewport,
    safeInsets: readSafeInsets(),
    extraBottom: extras.extraBottom,
    extraRight: extras.extraRight,
  });
}

function liveDefault(): FabPosition {
  const viewport = getViewportBox(window);
  const size = fabSizeForWidth(viewport.width);
  const extras = safariChromeClearance(viewport, window.innerHeight);
  return defaultFabPosition(size, viewport, { ...extras, safeInsets: readSafeInsets() });
}

function loadStoredPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FabPosition;
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return liveClamp(parsed);
  } catch {
    return null;
  }
}

export function OrderFloatingCartFab({ count, label, hidden, onClick }: Props) {
  const [position, setPosition] = useState<FabPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    captured: false,
  });
  const lastOpenAtRef = useRef(0);
  const skipClickRef = useRef(false);

  useLayoutEffect(() => {
    setPosition(loadStoredPosition() ?? liveDefault());
  }, []);

  useLayoutEffect(() => {
    const onResize = () => {
      setPosition((prev) => liveClamp(prev ?? liveDefault()));
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, []);

  const savePosition = useCallback((pos: FabPosition) => {
    const clamped = liveClamp(pos);
    setPosition(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const openCart = useCallback(() => {
    const now = Date.now();
    if (now - lastOpenAtRef.current < TAP_DEDUP_MS) return;
    lastOpenAtRef.current = now;
    onClick();
  }, [onClick]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position || e.button !== 0) return;
    const d = dragRef.current;
    d.active = true;
    d.moved = false;
    d.captured = false;
    d.pointerId = e.pointerId;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.originX = position.x;
    d.originY = position.y;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      if (!d.captured) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          d.captured = true;
        } catch {
          /* iPad Safari may reject capture */
        }
      }
    }

    e.preventDefault();
    savePosition({ x: d.originX + dx, y: d.originY + dy });
  };

  const finishPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;

    const wasDrag = d.moved;
    d.active = false;
    d.moved = false;
    setDragging(false);

    if (d.captured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      d.captured = false;
    }

    if (wasDrag) {
      skipClickRef.current = true;
      return;
    }

    openCart();
  };

  const onNativeClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      e.preventDefault();
      return;
    }
    openCart();
  };

  if (!position) return null;

  return (
    <button
      type="button"
      className={`order-floating-cart-fab${hidden ? " is-hidden" : ""}${dragging ? " is-dragging" : ""}`}
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClick={onNativeClick}
      aria-label={count > 0 ? `${label} (${count})` : label}
    >
      <span className="order-floating-cart-fab-ring" aria-hidden>
        <svg className="order-floating-cart-fab-icon" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 6.5h14.2l-1.4 8.2a1.6 1.6 0 0 1-1.58 1.3H8.2a1.6 1.6 0 0 1-1.58-1.3L4.8 4.5H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
          <circle cx="17" cy="19.5" r="1.5" fill="currentColor" />
        </svg>
      </span>
      {count > 0 ? (
        <span className="order-floating-cart-fab-badge">{count > 99 ? "99+" : count}</span>
      ) : null}
    </button>
  );
}
