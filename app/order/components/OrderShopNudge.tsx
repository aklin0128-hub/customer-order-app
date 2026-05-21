"use client";

import { copy } from "../orderCopy";
import type { Lang } from "../types";

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
    <div className="order-cart-nudge">
      <p className="order-cart-nudge-text">
        {t.clearanceReviewReminder.replace("{count}", String(clearanceDealCount))}
      </p>
      <div className="order-cart-nudge-actions">
        <button type="button" onClick={onAddClearanceMissing} className="order-cart-nudge-btn is-primary">
          {t.addMissingClearanceBar.replace("{count}", String(clearanceMissing))}
        </button>
        <button type="button" onClick={onViewClearance} className="order-cart-nudge-btn is-secondary">
          {t.viewClearance}
        </button>
      </div>
    </div>
  );
}
