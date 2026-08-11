"use client";

import { useEffect, useMemo, useState } from "react";

import { formatInvoiceUnitPrice } from "@/lib/customerInvoicePriceDisplay";
import {
  attachUnitPricesToSkuHistory,
  type SkuInvoicePricePoint,
} from "@/lib/skuInvoicePriceHistoryPure";
import {
  formatSkuOrderHistoryDate,
  getLatestSkuOrderHistoryEntry,
  sumSkuOrderHistoryCases,
  type SkuOrderHistoryEntry,
} from "@/lib/skuOrderHistory";
import { getCatalogItemBySku } from "../catalogUtils";
import { copy } from "../orderCopy";
import type { Lang } from "../types";
import { ProductImage } from "./ProductImage";

function HistoryPriceText({ unitPrice }: { unitPrice?: number }) {
  if (typeof unitPrice !== "number" || !(unitPrice > 0)) return null;
  return <span className="sku-order-history-price">{formatInvoiceUnitPrice(unitPrice)}</span>;
}

export function SkuOrderHistoryModal({
  open,
  onClose,
  lang,
  sku,
  accountNo,
  invoicePricingEnabled,
  entries,
  currentQty,
  onAddQty,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  sku: string;
  accountNo?: string;
  invoicePricingEnabled?: boolean;
  entries: SkuOrderHistoryEntry[];
  currentQty?: string | number;
  onAddQty: (qty: number) => void;
}) {
  const t = copy[lang];
  const cleanSku = String(sku || "").trim().toUpperCase();
  const catalogItem = getCatalogItemBySku(cleanSku);
  const [pricePoints, setPricePoints] = useState<SkuInvoicePricePoint[]>([]);
  const pricedEntries = useMemo(
    () => attachUnitPricesToSkuHistory(entries, pricePoints),
    [entries, pricePoints]
  );
  const latest = getLatestSkuOrderHistoryEntry(pricedEntries);
  const totalCases = sumSkuOrderHistoryCases(pricedEntries);
  const older = latest ? pricedEntries.slice(1) : pricedEntries;
  const inCart = Math.max(0, Math.floor(Number(currentQty) || 0));

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
    if (!open) {
      setPricePoints([]);
      return;
    }
    if (!invoicePricingEnabled || !accountNo || !cleanSku) {
      setPricePoints([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/customer-sku-price-history?accountNo=${encodeURIComponent(accountNo)}&sku=${encodeURIComponent(cleanSku)}`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.enabled || !Array.isArray(data.points)) {
          setPricePoints([]);
          return;
        }
        setPricePoints(data.points as SkuInvoicePricePoint[]);
      } catch {
        if (!cancelled) setPricePoints([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, invoicePricingEnabled, accountNo, cleanSku]);

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
              size={52}
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

        {pricedEntries.length > 0 ? (
          <p className="sku-order-history-summary">
            {t.skuHistorySummary
              .replace("{count}", String(pricedEntries.length))
              .replace("{cases}", String(totalCases))}
            {inCart > 0 ? ` · ${t.inCart}: ${inCart}` : ""}
          </p>
        ) : (
          <p className="sku-order-history-hint">{t.skuHistoryHint}</p>
        )}

        <div className="sku-order-history-body">
          {pricedEntries.length === 0 || !latest ? (
            <p className="sku-order-history-empty">{t.skuHistoryEmpty}</p>
          ) : (
            <>
              <section className="sku-order-history-latest">
                <div className="sku-order-history-latest-label">{t.lastOrdered}</div>
                <div className="sku-order-history-latest-row">
                  <div>
                    <div className="sku-order-history-date">
                      {formatSkuOrderHistoryDate(latest.createdAt, lang)}
                    </div>
                    <div className="sku-order-history-detail">
                      {latest.qty} {t.cases}
                      <HistoryPriceText unitPrice={latest.unitPrice} />
                      {latest.orderRef ? ` · ${latest.orderRef}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sku-order-history-reorder"
                    onClick={() => {
                      onAddQty(latest.qty);
                      onClose();
                    }}
                  >
                    {t.reorderLastQty.replace("{qty}", String(latest.qty))}
                  </button>
                </div>
              </section>

              {older.length > 0 ? (
                <>
                  <div className="sku-order-history-section-label">{t.earlierOrders}</div>
                  <ul className="sku-order-history-list">
                    {older.map((entry, index) => {
                      const key = `${entry.orderRef || "ref"}-${entry.createdAt || index}`;
                      return (
                        <li key={key} className="sku-order-history-row sku-order-history-row--readonly">
                          <div className="sku-order-history-row-meta">
                            <div className="sku-order-history-date">
                              {formatSkuOrderHistoryDate(entry.createdAt, lang)}
                            </div>
                            <div className="sku-order-history-detail">
                              {entry.qty} {t.cases}
                              <HistoryPriceText unitPrice={entry.unitPrice} />
                              {entry.orderRef ? ` · ${entry.orderRef}` : ""}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
