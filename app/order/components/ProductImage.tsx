"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { getImageUrl } from "../catalogUtils";

const Z_PREVIEW = 10050;
const HOVER_SCALE = 3;

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

  /** Fixed-position scaled clone escapes overflow + transformed ancestors (virtual catalog rows). */
  const [preview, setPreview] = useState<null | {
    src: string;
    altText: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }>(null);

  const src = imageUrl || getImageUrl(sku);

  useEffect(() => {
    if (!preview || !thumbWrapRef.current) return;
    const close = () => {
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

    const r = el.getBoundingClientRect();

    setPreview({
      src,
      altText: alt,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    });
  };

  const overlay =
    preview &&
    typeof document !== "undefined" &&
    createPortal(
      <img
        src={preview.src}
        alt={preview.altText}
        style={{
          position: "fixed",
          left: preview.left,
          top: preview.top,
          width: preview.width,
          height: preview.height,
          boxSizing: "border-box",
          zIndex: Z_PREVIEW,
          borderRadius: 10,
          background: "#fff",
          border: "2px solid #2563eb",
          boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
          objectFit: "contain",
          transform: `scale(${HOVER_SCALE})`,
          transformOrigin: "center center",
          transition: "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
          pointerEvents: "none",
        }}
        draggable={false}
      />,
      document.body,
    );

  return (
    <>
      {overlay}
      <div
        ref={thumbWrapRef}
        style={{ display: "inline-flex", lineHeight: 0, position: "relative" }}
        onMouseEnter={() => openPreview()}
        onMouseLeave={() => setPreview(null)}
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
