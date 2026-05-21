"use client";

import type { CSSProperties } from "react";

import { copy } from "../orderCopy";
import type { Lang } from "../types";

const bannerStyle: CSSProperties = {
  borderRadius: 12,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

/** Clearance-only cart nudge (weekly bulk-add prompts removed). */
export function OrderShopNudge({
  lang,
  clearanceMissing,
  clearanceDealCount,
  onAddClearanceMissing,
  onViewClearance,
}: {
  lang: Lang;
  clearanceMissing: number;
  clearanceDealCount: number;
  onAddClearanceMissing: () => void;
  onViewClearance: () => void;
}) {
  const t = copy[lang];

  if (clearanceMissing <= 0) return null;

  return (
    <div style={{ ...bannerStyle, border: "1px solid #fdba74", background: "#fff7ed" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#9a3412", lineHeight: 1.4 }}>
        {t.clearanceReviewReminder.replace("{count}", String(clearanceDealCount))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onAddClearanceMissing}
          style={{
            border: "1px solid #ea580c",
            background: "#ea580c",
            color: "#fff",
            borderRadius: 999,
            padding: "7px 12px",
            fontSize: 11,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {t.addMissingClearanceBar.replace("{count}", String(clearanceMissing))}
        </button>
        <button
          type="button"
          onClick={onViewClearance}
          style={{
            border: "1px solid #fdba74",
            background: "#fff",
            color: "#c2410c",
            borderRadius: 999,
            padding: "7px 12px",
            fontSize: 11,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {t.viewClearance}
        </button>
      </div>
    </div>
  );
}
