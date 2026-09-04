"use client";

import type { CSSProperties, ReactNode } from "react";

import { getCatalogItemBySku, isOrderableItem } from "../catalogUtils";
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
  onRemoveUnavailable,
  unavailableItems = [],
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
  onRemoveUnavailable?: () => void;
  unavailableItems?: Array<{ sku: string; status: string; nhItems?: boolean }>;
  nudge?: ReactNode;
  tools?: ReactNode;
}) {
  const t = copy[lang];
  const unavailableKey = new Set(
    unavailableItems.map((item) => `${item.sku.toUpperCase()}::${item.nhItems ? "nh" : "cat"}`)
  );

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

      {expanded && unavailableItems.length > 0 ? (
        <div
          style={{
            margin: "0 0 10px",
            border: "1px solid #fca5a5",
            background: "#fef2f2",
            color: "#991b1b",
            borderRadius: 12,
            padding: 10,
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 900 }}>{t.unavailableInCartTitle}</div>
          <div style={{ marginTop: 4 }}>{t.unavailableInCartHint}</div>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {unavailableItems.slice(0, 12).map((item) => (
              <div key={`${item.sku}-${item.nhItems ? "nh" : "cat"}`} style={{ fontWeight: 800 }}>
                • {item.sku}
                {item.status ? ` — ${item.status}` : ""}
              </div>
            ))}
            {unavailableItems.length > 12 ? <div>• …</div> : null}
          </div>
          {onRemoveUnavailable ? (
            <button
              type="button"
              onClick={onRemoveUnavailable}
              style={{
                marginTop: 8,
                border: "1px solid #fecaca",
                background: "#fff",
                color: "#b91c1c",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {t.removeUnavailable}
            </button>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div className={onClose ? "order-cart-modal-scroll" : undefined}>
          {items.length === 0 ? (
            <p className="order-cart-empty-hint">{t.noItems}</p>
          ) : (
            <div className="order-cart-list">
              {items.map((item) => {
                const catalogItem = getCatalogItemBySku(item.sku);
                const cleanSku = item.sku.toUpperCase();
                const lineKey = `${item.sku}-${item.nhItems ? "nh" : "cat"}`;
                const lineUnavailable =
                  unavailableKey.has(`${cleanSku}::${item.nhItems ? "nh" : "cat"}`) ||
                  (catalogItem ? !isOrderableItem(catalogItem) : true);
                return (
                  <div
                    key={lineKey}
                    className="order-cart-row"
                    style={lineUnavailable ? { borderColor: "#fca5a5", background: "#fef2f2" } : undefined}
                  >
                    <ProductImage sku={item.sku} alt={item.sku} size={48} imageUrl={catalogItem?.imageUrl} />
                    <div className="order-cart-row-info">
                      <div className="order-cart-row-sku">{item.sku}</div>
                      {catalogItem ? (
                        <div style={nameClampStyle}>
                          {catalogItem.brand ? `${catalogItem.brand} · ` : ""}
                          {catalogItem.name || ""}
                        </div>
                      ) : null}
                      {lineUnavailable ? (
                        <div className="order-cart-row-note is-warn" style={{ color: "#b91c1c", fontWeight: 800 }}>
                          {catalogItem
                            ? t.statusWarning
                                .replace("{sku}", cleanSku)
                                .replace(
                                  "{status}",
                                  String(catalogItem.status || "").trim().toUpperCase() || "UNAVAILABLE"
                                )
                            : t.unavailableMissingSku.replace("{sku}", cleanSku)}
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
