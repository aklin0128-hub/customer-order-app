"use client";

import { useState } from "react";

import { getImageUrl } from "../catalogUtils";

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
  const src = imageUrl || getImageUrl(sku);

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

  return (
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
        transition: "all 0.22s ease",
        cursor: "zoom-in",
        transformOrigin: "center center",
        position: "relative",
        zIndex: 1,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(3)";
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.border = "2px solid #2563eb";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.25)";
        e.currentTarget.style.zIndex = "9999";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.border = "1px solid #e5e7eb";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.zIndex = "1";
      }}
      onError={() => setImgError(true)}
    />
  );
}
