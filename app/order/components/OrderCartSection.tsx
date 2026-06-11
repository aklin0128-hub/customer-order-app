"use client";

import type { CSSProperties, ReactNode } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import { clearancePolicyStyle } from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

export function OrderCartSection({
  lang,
  items,
  expanded,
  onToggleExpanded,
  onClose,
  lineCount,
  totalCases,
  onAdjustQty,
  onQtyInput,
  onRemove,
  nhItemsSkus,
  nudge,
  tools,
}: {
  lang: Lang;
  items: CartItem[];
  nhItemsSkus?: Set<string>;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose?: () => void;
  lineCount: number;
  totalCases: number;
  onAdjustQty: (sku: string, delta: number, nhItems?: boolean) => void;
  onQtyInput: (sku: string, value: string, nhItems?: boolean) => void;
  onRemove: (sku: string, nhItems?: boolean) => void;
  nudge?: ReactNode;
  tools?: ReactNode;
}) {
  const t = copy[lang];

  const nameClampStyle: CSSProperties = {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 1.35,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  };

  return (
    <section id="order-cart" className={`order-cart-card${lineCount === 0 ? " is-empty" : ""}`}>
      <div className="order-cart-header">
        {onClose ? (
          <>
            <div className="order-cart-header-main">
              <h2 id="order-cart-heading" className="order-cart-header-title">
                {t.orderCart}
              </h2>
              {lineCount > 0 ? (
                <span className="order-cart-header-count">
                  {lineCount} {t.lines} · {totalCases} {t.cases}
                </span>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="order-cart-close-btn" aria-label={t.close}>
              ×
            </button>
          </>
        ) : (
          <button type="button" onClick={onToggleExpanded} className="order-cart-header-btn">
            <span className="order-cart-header-title">
              {t.orderCart}
              {lineCount > 0 ? (
                <span className="order-cart-header-count">
                  {lineCount} {t.lines} · {totalCases} {t.cases}
                </span>
              ) : null}
            </span>
            <span className="order-cart-header-action">{expanded ? t.hideCart : t.showCart}</span>
          </button>
        )}
      </div>

      {expanded && nudge ? nudge : null}

      {expanded ? (
        <div className={onClose ? "order-cart-modal-scroll" : undefined}>
          {items.length === 0 ? (
            <p className="order-cart-empty-hint">{t.noItems}</p>
          ) : (
            <div className="order-cart-list">
              {items.map((item) => {
                const catalogItem = getCatalogItemBySku(item.sku);
                const lineKey = `${item.sku}-${item.nhItems ? "nh" : "cat"}`;
                return (
                  <div key={lineKey} className="order-cart-row">
                    <ProductImage sku={item.sku} alt={item.sku} size={48} imageUrl={catalogItem?.imageUrl} />
                    <div className="order-cart-row-info">
                      <div className="order-cart-row-sku">{item.sku}</div>
                      {catalogItem ? (
                        <div style={nameClampStyle}>
                          {catalogItem.brand ? `${catalogItem.brand} · ` : ""}
                          {catalogItem.name || ""}
                        </div>
                      ) : null}
                      {catalogItem?.limitedQty ? (
                        <div className="order-cart-row-note is-warn">
                          {t.limited}: {catalogItem.limitedQty}
                        </div>
                      ) : null}
                      {item.nhItems ? (
                        <div style={{ ...clearancePolicyStyle, marginTop: 4, fontSize: 10 }}>{t.clearanceNoReturn}</div>
                      ) : null}
                    </div>
                    <div className="order-cart-row-actions">
                      <div className="order-cart-qty">
                        <button type="button" onClick={() => onAdjustQty(item.sku, -1, item.nhItems)} className="order-cart-qty-btn" aria-label="-">
                          −
                        </button>
                        <input
                          value={item.qty}
                          onChange={(e) => onQtyInput(item.sku, e.target.value, item.nhItems)}
                          inputMode="numeric"
                          className="order-cart-qty-input"
                          aria-label={item.sku}
                        />
                        <button type="button" onClick={() => onAdjustQty(item.sku, 1, item.nhItems)} className="order-cart-qty-btn" aria-label="+">
                          +
                        </button>
                      </div>
                      <button type="button" onClick={() => onRemove(item.sku, item.nhItems)} className="order-cart-remove-btn">
                        {t.remove}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tools ? tools : null}
        </div>
      ) : null}
    </section>
  );
}
