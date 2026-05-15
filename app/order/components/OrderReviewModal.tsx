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
