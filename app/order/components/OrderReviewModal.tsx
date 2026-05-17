"use client";

import { useEffect } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import {
  compactQtyStripWrapStyle,
  dangerSmallButtonStyle,
  reviewItemStyle,
  reviewListStyle,
  reviewModalFooterStyle,
  reviewModalHeaderStyle,
  reviewModalStyle,
  reviewOverlayStyle,
  reviewQtyButtonStyle,
  reviewQtyControlStyle,
  reviewQtyInputStyle,
  reviewRemoveButtonStyle,
  secondaryButtonStyle,
  submitButtonStyle,
} from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

export function OrderReviewModal({
  open,
  onClose,
  lang,
  items,
  warnings = [],
  promoReminder,
  newItemsReminder,
  accountNo,
  storeName,
  submitting,
  onAdjustQty,
  onQtyInput,
  onRemove,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  items: CartItem[];
  warnings?: string[];
  promoReminder?: {
    count: number;
    onView: () => void;
  } | null;
  newItemsReminder?: {
    count: number;
    onView: () => void;
  } | null;
  accountNo: string;
  storeName: string;
  submitting: boolean;
  onAdjustQty: (sku: string, delta: number) => void;
  onQtyInput: (sku: string, value: string) => void;
  onRemove: (sku: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const t = copy[lang];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || submitting) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <div
      style={reviewOverlayStyle}
      onClick={(e) => {
        if (submitting || e.target !== e.currentTarget) return;
        onClose();
      }}
      role="presentation"
    >
      <div
        style={reviewModalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="review-order-heading"
        aria-modal="true"
      >
        <header style={reviewModalHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div id="review-order-heading" style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
              {t.reviewOrder}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.4, wordBreak: "break-word" }}>
              <span>{accountNo}</span>
              {(accountNo || storeName) ? " · " : null}
              <span>{storeName}</span>
              {(accountNo || storeName) ? " · " : null}
              {items.length} {t.items}
            </div>
          </div>
          <button type="button" onClick={() => (submitting ? undefined : onClose())} disabled={submitting} style={dangerSmallButtonStyle}>
            {t.close}
          </button>
        </header>

        {warnings.length > 0 ? (
          <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 4 }}>{t.reviewWarnings}</div>
            {warnings.slice(0, 6).map((warning) => (
              <div key={warning}>• {warning}</div>
            ))}
            {warnings.length > 6 ? <div>• ...</div> : null}
          </div>
        ) : null}

        {promoReminder ? (
          <div style={{ border: "1px solid #5eead4", background: "#f0fdfa", color: "#115e59", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              {t.promoReviewReminder.replace("{count}", String(promoReminder.count))}
            </div>
            <button
              type="button"
              onClick={promoReminder.onView}
              disabled={submitting}
              style={{
                border: "1px solid #0f766e",
                background: "#ccfbf1",
                color: "#0f766e",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 900,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {t.viewPromotions}
            </button>
          </div>
        ) : null}

        {newItemsReminder ? (
          <div style={{ border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>
              {t.newItemsReviewReminder.replace("{count}", String(newItemsReminder.count))}
            </div>
            <button
              type="button"
              onClick={newItemsReminder.onView}
              disabled={submitting}
              style={{
                border: "1px solid #ea580c",
                background: "#ffedd5",
                color: "#c2410c",
                borderRadius: 999,
                padding: "7px 12px",
                fontSize: 12,
                fontWeight: 900,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {t.viewNewItems}
            </button>
          </div>
        ) : null}

        <div style={reviewListStyle}>
          {items.map((item, index) => {
            const catalogItem = getCatalogItemBySku(item.sku);
            const hasMetaLine = !!(catalogItem?.limitedQty || catalogItem?.palletSize);

            return (
              <article key={`${item.sku}-${index}`} style={reviewItemStyle}>
                <div style={{ flex: "1 1 min(260px, 100%)", minWidth: 0, display: "flex", gap: 10 }}>
                  <ProductImage sku={item.sku} alt={item.sku} size={48} imageUrl={catalogItem?.imageUrl} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{item.sku}</div>
                    <div
                      title={`${catalogItem?.brand ? `${catalogItem.brand} | ` : ""}${catalogItem?.name ?? ""}`}
                      style={{
                        fontSize: 12,
                        color: "#4b5563",
                        marginTop: 3,
                        lineHeight: 1.35,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}
                      {catalogItem?.name || "-"}
                    </div>
                    {hasMetaLine ? (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                        {catalogItem?.palletSize ? `${t.pallet}: ${catalogItem.palletSize}` : ""}
                        {catalogItem?.palletSize && catalogItem?.limitedQty ? " · " : ""}
                        {catalogItem?.limitedQty ? `${t.limited}: ${catalogItem.limitedQty}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={compactQtyStripWrapStyle}>
                  <div style={{ ...reviewQtyControlStyle, width: "100%", maxWidth: 300 }}>
                    <button type="button" onClick={() => onAdjustQty(item.sku, -1)} style={reviewQtyButtonStyle}>
                      −
                    </button>
                    <input
                      value={item.qty}
                      onChange={(e) => onQtyInput(item.sku, e.target.value)}
                      inputMode="numeric"
                      style={reviewQtyInputStyle}
                    />
                    <button type="button" onClick={() => onAdjustQty(item.sku, 1)} style={reviewQtyButtonStyle}>
                      +
                    </button>
                    <button type="button" onClick={() => onRemove(item.sku)} style={reviewRemoveButtonStyle}>
                      {t.remove}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <footer style={reviewModalFooterStyle}>
          <button type="button" onClick={() => (submitting ? undefined : onClose())} disabled={submitting} style={secondaryButtonStyle}>
            {t.back}
          </button>
          <button
            type="button"
            onClick={() => {
              void onSubmit();
            }}
            disabled={submitting}
            style={{ ...submitButtonStyle, background: submitting ? "#93c5fd" : "#16a34a" }}
          >
            {submitting ? t.submitting : t.confirmSubmit}
          </button>
        </footer>
      </div>
    </div>
  );
}
