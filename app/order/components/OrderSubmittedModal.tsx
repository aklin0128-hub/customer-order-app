"use client";

import { useEffect } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import {
  reviewItemStyle,
  reviewModalStyle,
  reviewOverlayStyle,
  submitButtonStyle,
  submittedOrderListStyle,
  secondaryButtonStyle,
  promoTagStyle,
} from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";
import type { UpsellLine } from "./SalesUpsellPanel";

export function OrderSubmittedModal({
  open,
  onDone,
  lang,
  orderRef,
  items,
  suggestLines = [],
  onBrowseWeeklyPicks,
}: {
  open: boolean;
  onDone: () => void;
  lang: Lang;
  orderRef: string;
  items: CartItem[];
  suggestLines?: UpsellLine[];
  onBrowseWeeklyPicks?: () => void;
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
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDone]);

  if (!open) return null;

  return (
    <div
      style={reviewOverlayStyle}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        onDone();
      }}
      role="presentation"
    >
      <div
        style={{ ...reviewModalStyle, maxHeight: "min(88vh, 680px)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="order-submitted-heading"
        aria-modal="true"
      >
        <div id="order-submitted-heading" style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", textAlign: "center", flexShrink: 0 }}>
          {t.orderSubmitted}
        </div>
        <div style={{ fontSize: 14, color: "#374151", textAlign: "center", marginTop: 8, wordBreak: "break-word", flexShrink: 0 }}>
          {t.ref}: {orderRef}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 4, flexShrink: 0 }}>
          {items.length} {t.items}
        </div>

        <div style={submittedOrderListStyle}>
          {items.map((item, index) => {
            const catalogItem = getCatalogItemBySku(item.sku);
            return (
              <div key={`${item.sku}-${index}`} style={{ ...reviewItemStyle, flexDirection: "column", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{item.sku}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.35 }}>
                      {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}
                      {catalogItem?.name || "-"}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#16a34a", alignSelf: "center" }}>
                    {t.qty}: {item.qty}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {suggestLines.length > 0 ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid #5eead4",
              background: "#f0fdfa",
              borderRadius: 12,
              padding: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: "#115e59" }}>{t.postSubmitSuggestTitle}</div>
            <div style={{ fontSize: 12, color: "#0f766e", marginTop: 4, lineHeight: 1.45 }}>{t.postSubmitSuggestHint}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {suggestLines.map((line) => (
                <div
                  key={line.sku}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: 8,
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #99f6e4",
                  }}
                >
                  <ProductImage sku={line.sku} alt={line.sku} size={40} imageUrl={line.imageUrl} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{line.sku}</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>{line.name || "—"}</div>
                    {line.priceLabel ? (
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#0f766e", marginTop: 2 }}>{line.priceLabel}</div>
                    ) : null}
                  </div>
                  {line.badge ? <span style={{ ...promoTagStyle, fontSize: 9 }}>{line.badge}</span> : null}
                </div>
              ))}
            </div>
            {onBrowseWeeklyPicks ? (
              <button
                type="button"
                onClick={onBrowseWeeklyPicks}
                style={{ ...secondaryButtonStyle, width: "100%", marginTop: 10, borderColor: "#0f766e", color: "#0f766e" }}
              >
                {t.browseMoreWeeklyPicks}
              </button>
            ) : null}
          </div>
        ) : null}

        <button type="button" onClick={onDone} style={{ ...submitButtonStyle, background: "#2563eb", marginTop: 12, flexShrink: 0 }}>
          {t.done}
        </button>
      </div>
    </div>
  );
}
