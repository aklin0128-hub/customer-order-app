"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "order_fab_position_v1";
const DRAG_THRESHOLD_PX = 6;

type Props = {
  count: number;
  label: string;
  hidden?: boolean;
  onClick: () => void;
};

type Position = { x: number; y: number };

function getFabSize() {
  if (typeof window === "undefined") return 64;
  return window.innerWidth >= 768 ? 68 : 64;
}

function clampPosition(pos: Position, size = getFabSize()): Position {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - size - margin);
  const maxY = Math.max(margin, window.innerHeight - size - margin);
  return {
    x: Math.min(Math.max(margin, pos.x), maxX),
    y: Math.min(Math.max(margin, pos.y), maxY),
  };
}

function defaultPosition(): Position {
  const size = getFabSize();
  const marginY = window.innerWidth >= 768 ? 24 : 16;
  const marginX = window.innerWidth >= 768 ? 24 : 14;
  return clampPosition(
    {
      x: window.innerWidth - size - marginX,
      y: window.innerHeight - size - marginY,
    },
    size
  );
}

function loadStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Position;
    if (!Number.isFinite(parsed?.x) || !Number.isFinite(parsed?.y)) return null;
    return clampPosition(parsed);
  } catch {
    return null;
  }
}

export function OrderFloatingCartFab({ count, label, hidden, onClick }: Props) {
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useLayoutEffect(() => {
    setPosition(loadStoredPosition() ?? defaultPosition());
  }, []);

  useLayoutEffect(() => {
    const onResize = () => {
      setPosition((prev) => (prev ? clampPosition(prev) : defaultPosition()));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const savePosition = useCallback((pos: Position) => {
    const clamped = clampPosition(pos);
    setPosition(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position || e.button !== 0) return;
    const d = dragRef.current;
    d.active = true;
    d.moved = false;
    d.pointerId = e.pointerId;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.originX = position.x;
    d.originY = position.y;
    e.currentTarget.setPointerCapture(e.pointerId);
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

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }

    if (!wasDrag) onClick();
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
