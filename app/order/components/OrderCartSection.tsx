"use client";

import type { CSSProperties } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import {
  cartItemStyle,
  cartListScrollStyle,
  cartQtyStripWrapStyle,
  dangerSmallButtonStyle,
  emptyStyle,
  cardStyle,
  reviewQtyButtonStyle,
  reviewQtyControlStyle,
  reviewQtyInputStyle,
  sectionTitleStyle,
  sectionToggleStyle,
  clearancePolicyStyle,
  toggleTextStyle,
} from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

export function OrderCartSection({
  lang,
  items,
  expanded,
  onToggleExpanded,
  lineCount,
  totalCases,
  onAdjustQty,
  onQtyInput,
  onRemove,
  clearanceSkus,
}: {
  lang: Lang;
  items: CartItem[];
  clearanceSkus?: Set<string>;
  expanded: boolean;
  onToggleExpanded: () => void;
  lineCount: number;
  totalCases: number;
  onAdjustQty: (sku: string, delta: number) => void;
  onQtyInput: (sku: string, value: string) => void;
  onRemove: (sku: string) => void;
}) {
  const t = copy[lang];

  const nameClampStyle: CSSProperties = {
    fontSize: 12,
    color: "#4b5563",
    marginTop: 4,
    lineHeight: 1.35,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };

  return (
    <section id="order-cart" style={{ ...cardStyle, overflow: "visible" }}>
      <button type="button" onClick={onToggleExpanded} style={sectionToggleStyle}>
        <div style={sectionTitleStyle}>
          {t.orderCart} ({lineCount}) · {totalCases} {t.cases}
        </div>
        <div style={toggleTextStyle}>{expanded ? t.hideCart : t.showCart}</div>
      </button>

      {expanded ? (
        items.length === 0 ? (
          <div style={emptyStyle}>{t.noItems}</div>
        ) : (
          <div style={cartListScrollStyle}>
            {items.map((item) => {
              const catalogItem = getCatalogItemBySku(item.sku);
              return (
                <div key={item.sku} style={cartItemStyle}>
                  <div style={{ flex: "1 1 200px", minWidth: 0, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <ProductImage sku={item.sku} alt={item.sku} size={52} imageUrl={catalogItem?.imageUrl} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", lineHeight: 1.2 }}>{item.sku}</div>
                      {catalogItem ? (
                        <div style={nameClampStyle}>
                          {catalogItem.brand ? `${catalogItem.brand} | ` : ""}
                          {catalogItem.name || ""}
                        </div>
                      ) : null}
                      {catalogItem?.limitedQty ? (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", marginTop: 4 }}>
                          {t.limited}: {catalogItem.limitedQty}
                        </div>
                      ) : null}
                      {clearanceSkus?.has(item.sku.toUpperCase()) ? (
                        <div style={{ ...clearancePolicyStyle, marginTop: 6 }}>{t.clearanceNoReturn}</div>
                      ) : null}
                    </div>
                  </div>

                  <div style={cartQtyStripWrapStyle}>
                    <div style={{ ...reviewQtyControlStyle, width: "100%", maxWidth: 288 }}>
                      <button type="button" onClick={() => onAdjustQty(item.sku, -1)} style={reviewQtyButtonStyle}>
                        −
                      </button>
                      <input value={item.qty} onChange={(e) => onQtyInput(item.sku, e.target.value)} inputMode="numeric" style={reviewQtyInputStyle} />
                      <button type="button" onClick={() => onAdjustQty(item.sku, 1)} style={reviewQtyButtonStyle}>
                        +
                      </button>
                      <button type="button" onClick={() => onRemove(item.sku)} style={dangerSmallButtonStyle}>
                        {t.remove}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </section>
  );
}
