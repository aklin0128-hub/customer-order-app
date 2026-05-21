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

export function OrderShopNudge({
  lang,
  weeklyMissing,
  clearanceMissing,
  clearanceDealCount,
  weeklyInCart,
  onAddWeeklyMissing,
  onAddClearanceMissing,
  onViewWeekly,
  onViewClearance,
}: {
  lang: Lang;
  weeklyMissing: number;
  clearanceMissing: number;
  clearanceDealCount: number;
  weeklyInCart: number;
  onAddWeeklyMissing: () => void;
  onAddClearanceMissing: () => void;
  onViewWeekly: () => void;
  onViewClearance: () => void;
}) {
  const t = copy[lang];

  if (weeklyMissing === 0 && clearanceMissing === 0 && weeklyInCart > 0) return null;
  if (weeklyMissing === 0 && clearanceMissing === 0 && weeklyInCart === 0) {
    return (
      <div style={{ ...bannerStyle, border: "1px solid #5eead4", background: "#f0fdfa" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#115e59", lineHeight: 1.4 }}>{t.promoReviewReminder}</div>
        <button
          type="button"
          onClick={onViewWeekly}
          style={{
            alignSelf: "flex-start",
            border: "1px solid #0f766e",
            background: "#0f766e",
            color: "#fff",
            borderRadius: 999,
            padding: "7px 14px",
            fontSize: 12,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {t.viewPromotions}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {weeklyMissing > 0 ? (
        <div style={{ ...bannerStyle, border: "1px solid #5eead4", background: "#f0fdfa" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#115e59", lineHeight: 1.4 }}>
            {t.missingWeeklyPicksTitle} ({weeklyMissing})
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onAddWeeklyMissing}
              style={{
                border: "1px solid #0f766e",
                background: "#0f766e",
                color: "#fff",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 11,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {t.addMissingPicksBar.replace("{count}", String(weeklyMissing))}
            </button>
            <button
              type="button"
              onClick={onViewWeekly}
              style={{
                border: "1px solid #99f6e4",
                background: "#fff",
                color: "#0f766e",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t.viewPromotions}
            </button>
          </div>
        </div>
      ) : null}

      {clearanceMissing > 0 ? (
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
      ) : null}
    </div>
  );
}
