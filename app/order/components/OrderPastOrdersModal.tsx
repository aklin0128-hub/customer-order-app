"use client";

import { useEffect, useState } from "react";

import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import { secondaryButtonStyle, toggleTextStyle } from "../orderStyles";
import type { CartItem, Lang, OrderHistoryItem } from "../types";
import { ProductImage } from "./ProductImage";

export function OrderPastOrdersModal({
  open,
  onClose,
  lang,
  orders,
  onReorder,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  orders: OrderHistoryItem[];
  onReorder: (items: CartItem[]) => void;
}) {
  const t = copy[lang];
  const [expandedKey, setExpandedKey] = useState("");

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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setExpandedKey("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="order-past-orders-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="order-past-orders-modal"
        role="dialog"
        aria-labelledby="order-past-orders-heading"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="order-past-orders-header">
          <div>
            <h2 id="order-past-orders-heading" className="order-past-orders-title">
              {t.history}
            </h2>
            <p className="order-past-orders-subtitle">{t.historyModalHint}</p>
          </div>
          <button type="button" onClick={onClose} className="order-past-orders-close" aria-label={t.close}>
            ×
          </button>
        </header>

        <div className="order-past-orders-body">
          {orders.length === 0 ? (
            <p className="order-past-orders-empty">{t.noItems}</p>
          ) : (
            <div className="order-past-orders-list">
              {orders.slice(0, 12).map((order, index) => {
                const key = order.orderRef || order.createdAt || String(index);
                const items = order.items || [];
                const expanded = expandedKey === key;
                const totalCases = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

                return (
                  <article key={key} className="order-past-orders-card">
                    <button
                      type="button"
                      className="order-past-orders-card-head"
                      onClick={() => setExpandedKey((prev) => (prev === key ? "" : key))}
                    >
                      <div className="order-past-orders-card-meta">
                        <div className="order-past-orders-card-ref">{order.orderRef || "—"}</div>
                        <div className="order-past-orders-card-detail">
                          {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {items.length}{" "}
                          {t.items} · {totalCases} {t.cases}
                        </div>
                        {!expanded ? (
                          <div className="order-past-orders-card-preview">
                            {items
                              .slice(0, 4)
                              .map((item) => `${item.sku}(${item.qty})`)
                              .join(", ")}
                            {items.length > 4 ? "…" : ""}
                          </div>
                        ) : null}
                      </div>
                      <span style={toggleTextStyle}>{expanded ? t.hideDetails : t.viewDetails}</span>
                    </button>

                    {expanded ? (
                      <div className="order-past-orders-card-lines">
                        {items.map((item, itemIndex) => {
                          const catalogItem = getCatalogItemBySku(item.sku);
                          return (
                            <div key={`${item.sku}-${itemIndex}`} className="order-past-orders-line">
                              <ProductImage
                                sku={item.sku}
                                alt={item.sku}
                                size={40}
                                imageUrl={catalogItem?.imageUrl}
                              />
                              <div className="order-past-orders-line-meta">
                                <div className="order-past-orders-line-sku">{item.sku}</div>
                                <div className="order-past-orders-line-name">
                                  {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}
                                  {catalogItem?.name || "—"}
                                </div>
                              </div>
                              <div className="order-past-orders-line-qty">
                                {t.qty}: {item.qty}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      className="order-past-orders-reorder-btn"
                      style={secondaryButtonStyle}
                      onClick={() => {
                        onReorder(items);
                        onClose();
                      }}
                    >
                      {t.reorder}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
