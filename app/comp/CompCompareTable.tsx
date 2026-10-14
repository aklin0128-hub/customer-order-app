"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type CSSProperties } from "react";
import type { InvoiceCompareColumn, InvoiceCompareRow } from "@/lib/invoiceCompareCsv";

const ROW_H = 36;
const HEADER_H = 58;
const COL_SKU = 90;
const COL_BRAND = 120;
const COL_NAME = 200;
const COL_PRICE = 88;
const FROZEN_W = COL_SKU + COL_BRAND + COL_NAME;

const thStyle: CSSProperties = {
  padding: "6px 8px",
  textAlign: "left",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};

function formatPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 100) / 100}%`;
}

function formatPrice(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

function rowPriceChanged(row: InvoiceCompareRow) {
  return row.cells.some((cell, index) => index > 0 && cell.changePct != null && cell.changePct !== 0);
}

export function CompCompareTable({
  invoices,
  rows,
  includedKeys,
  onExclude,
}: {
  invoices: InvoiceCompareColumn[];
  rows: InvoiceCompareRow[];
  includedKeys: string[];
  onExclude: (key: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const priceWidth = Math.max(invoices.length, 1) * COL_PRICE;
  const totalWidth = FROZEN_W + priceWidth;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  return (
    <div ref={scrollRef} className="comp-table-scroll">
      <div style={{ width: totalWidth, minWidth: "100%" }}>
        <div className="comp-virtual-header" style={{ height: HEADER_H, width: totalWidth }}>
          <div className="comp-virtual-frozen" style={{ width: FROZEN_W }}>
            <div className="comp-vh-sku" style={{ ...thStyle, width: COL_SKU }}>
              SKU
            </div>
            <div className="comp-vh-brand" style={{ ...thStyle, width: COL_BRAND }}>
              Brand
            </div>
            <div className="comp-vh-name" style={{ ...thStyle, width: COL_NAME }}>
              Name
            </div>
          </div>
          <div className="comp-virtual-prices" style={{ width: priceWidth }}>
            {invoices.map((inv, index) => {
              const key = includedKeys[index];
              return (
                <div
                  key={`head-${inv.importId || inv.invoiceNo}-${index}`}
                  className="comp-vh-price"
                  style={{ width: COL_PRICE, ...thStyle, textAlign: "right", lineHeight: 1.2 }}
                >
                  <div>{inv.date || "—"}</div>
                  <div className="comp-invoice-no">
                    <span className="comp-invoice-no-text">{inv.invoiceNo || "—"}</span>
                    <button
                      type="button"
                      className="comp-exclude-btn"
                      onClick={() => onExclude(key)}
                      title="Exclude this invoice"
                      aria-label={`Exclude invoice ${inv.invoiceNo || inv.date}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: totalWidth,
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vr) => {
            const row = rows[vr.index];
            const changed = rowPriceChanged(row);
            return (
              <div
                key={vr.key}
                data-index={vr.index}
                className={`comp-virtual-row${changed ? " is-price-changed" : ""}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: totalWidth,
                  height: vr.size,
                  transform: `translateY(${vr.start}px)`,
                }}
              >
                <div className="comp-virtual-frozen" style={{ width: FROZEN_W }}>
                  <div
                    className={`comp-cell-sku${changed ? " is-price-changed" : ""}`}
                    style={{ width: COL_SKU }}
                    title={changed ? "Price changed across invoices" : undefined}
                  >
                    {row.sku}
                  </div>
                  <div className="comp-cell-brand" style={{ width: COL_BRAND }} title={row.brand || undefined}>
                    {row.brand || "—"}
                  </div>
                  <div className="comp-cell-name" style={{ width: COL_NAME }} title={row.name || undefined}>
                    {row.name || "—"}
                  </div>
                </div>
                <div className="comp-virtual-prices" style={{ width: priceWidth }}>
                  {row.cells.map((cell, index) => {
                    const up = index > 0 && cell.changePct != null && cell.changePct > 0;
                    const down = index > 0 && cell.changePct != null && cell.changePct < 0;
                    return (
                      <div
                        key={`${row.sku}-${index}`}
                        className="comp-cell-price"
                        title={
                          index > 0 && cell.changePct != null
                            ? `Change vs previous: ${formatPct(cell.changePct)}`
                            : undefined
                        }
                        style={{
                          width: COL_PRICE,
                          color: up ? "#991b1b" : down ? "#065f46" : "#111827",
                          background: up ? "#fee2e2" : down ? "#d1fae5" : undefined,
                        }}
                      >
                        {formatPrice(cell.price)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
