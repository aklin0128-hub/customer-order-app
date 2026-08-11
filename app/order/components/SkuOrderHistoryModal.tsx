"use client";

import { useEffect } from "react";

import { formatSkuOrderHistoryDate, type SkuOrderHistoryEntry } from "@/lib/skuOrderHistory";
import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import type { Lang } from "../types";
import { ProductImage } from "./ProductImage";

export function SkuOrderHistoryModal({
  open,
  onClose,
  lang,
  sku,
  entries,
  onAddQty,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  sku: string;
  entries: SkuOrderHistoryEntry[];
  onAddQty: (qty: number) => void;
}) {
  const t = copy[lang];
  const cleanSku = String(sku || "").trim().toUpperCase();
  const catalogItem = getCatalogItemBySku(cleanSku);

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

  if (!open || !cleanSku) return null;

  return (
    <div
      className="sku-order-history-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="sku-order-history-modal"
        role="dialog"
        aria-labelledby="sku-order-history-heading"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sku-order-history-header">
          <div className="sku-order-history-product">
            <ProductImage
              sku={cleanSku}
              alt={cleanSku}
              size={48}
              imageUrl={catalogItem?.imageUrl}
            />
            <div>
              <h2 id="sku-order-history-heading" className="sku-order-history-title">
                {t.skuHistory}
              </h2>
              <div className="sku-order-history-sku">{cleanSku}</div>
              <div className="sku-order-history-name">
                {[catalogItem?.brand, catalogItem?.name].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="sku-order-history-close" aria-label={t.close}>
            ×
          </button>
        </header>

        <p className="sku-order-history-hint">{t.skuHistoryHint}</p>

        <div className="sku-order-history-body">
          {entries.length === 0 ? (
            <p className="sku-order-history-empty">{t.skuHistoryEmpty}</p>
          ) : (
            <ul className="sku-order-history-list">
              {entries.map((entry, index) => {
                const key = `${entry.orderRef || "ref"}-${entry.createdAt || index}`;
                return (
                  <li key={key} className="sku-order-history-row">
                    <div className="sku-order-history-row-meta">
                      <div className="sku-order-history-date">
                        {formatSkuOrderHistoryDate(entry.createdAt, lang)}
                      </div>
                      <div className="sku-order-history-detail">
                        {entry.qty} {t.cases}
                        {entry.orderRef ? ` · ${entry.orderRef}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sku-order-history-add"
                      onClick={() => {
                        onAddQty(entry.qty);
                        onClose();
                      }}
                    >
                      {t.addHistoryQty.replace("{qty}", String(entry.qty))}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
