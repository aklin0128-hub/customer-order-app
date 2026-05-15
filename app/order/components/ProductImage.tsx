"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getImageUrl } from "../catalogUtils";

const PREVIEW_SIDE = 248;
const Z_PREVIEW = 10050;
/** Grace period so cursor can cross the gap onto the enlarged preview without flicker. */
const LEAVE_HIDE_MS = 160;

function getScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body && node.parentElement) {
    const { overflowY, overflowX } = window.getComputedStyle(node);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowX === "auto" ||
      overflowX === "scroll"
    )
      out.push(node);
    node = node.parentElement;
  }
  return out;
}

function clampToViewport(left: number, top: number, width: number, height: number) {
  const margin = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    left: Math.min(Math.max(margin, left), vw - width - margin),
    top: Math.min(Math.max(margin, top), vh - height - margin),
  };
}

export function ProductImage({
  sku,
  alt,
  size = 56,
  imageUrl,
}: {
  sku?: string;
  alt: string;
  size?: number;
  imageUrl?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const thumbWrapRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);

  /** Fixed-position preview escapes overflow + transformed ancestors (virtual catalog rows). */
  const [preview, setPreview] = useState<null | {
    src: string;
    altText: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }>(null);

  const src = imageUrl || getImageUrl(sku);

  const cancelHidePreview = () => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHidePreview = () => {
    cancelHidePreview();
    hideTimerRef.current = window.setTimeout(() => {
      setPreview(null);
      hideTimerRef.current = null;
    }, LEAVE_HIDE_MS);
  };

  useEffect(() => () => cancelHidePreview(), []);

  useEffect(() => {
    if (!preview || !thumbWrapRef.current) return;
    const close = () => {
      cancelHidePreview();
      setPreview(null);
    };
    const ancestors = getScrollableAncestors(thumbWrapRef.current);
    for (const el of ancestors) el.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      for (const el of ancestors) el.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [preview]);

  if (!sku || imgError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9ca3af",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        No Image
      </div>
    );
  }

  const openPreview = () => {
    const el = thumbWrapRef.current;
    if (!el) return;

    cancelHidePreview();
    const r = el.getBoundingClientRect();
    const pw = PREVIEW_SIDE;
    const ph = PREVIEW_SIDE;
    let left = r.left + r.width / 2 - pw / 2;
    // Pull up slightly so the preview overlaps the thumb — easier hover handoff without flicker
    let top = r.bottom - Math.min(28, r.height * 0.35);
    if (top + ph > window.innerHeight - 10) {
      top = r.top - ph + Math.min(28, r.height * 0.35);
    }

    ({ left, top } = clampToViewport(left, top, pw, ph));

    setPreview({
      src,
      altText: alt,
      left,
      top,
      width: pw,
      height: ph,
    });
  };

  const overlay =
    preview &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        style={{
          position: "fixed",
          left: preview.left,
          top: preview.top,
          width: preview.width,
          height: preview.height,
          boxSizing: "border-box",
          zIndex: Z_PREVIEW,
          borderRadius: 12,
          overflow: "hidden",
          cursor: "zoom-out",
          background: "#fff",
          border: "2px solid #2563eb",
          boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
          padding: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={() => cancelHidePreview()}
        onMouseLeave={() => scheduleHidePreview()}
      >
        <img
          src={preview.src}
          alt={preview.altText}
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            maxWidth: "min(236px, 88vw)",
            maxHeight: "min(236px, 52vh)",
            objectFit: "contain",
          }}
        />
      </div>,
      document.body,
    );

  return (
    <>
      {overlay}
      <div
        ref={thumbWrapRef}
        style={{ display: "inline-flex", lineHeight: 0, position: "relative" }}
        onMouseEnter={() => openPreview()}
        onMouseLeave={() => scheduleHidePreview()}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: size,
            height: size,
            objectFit: "contain",
            borderRadius: 10,
            background: "#fff",
            border: "1px solid #e5e7eb",
            flexShrink: 0,
            transition: "box-shadow 0.18s ease, border-color 0.18s ease",
            cursor: "zoom-in",
          }}
          onError={() => setImgError(true)}
        />
      </div>
    </>
  );
}
