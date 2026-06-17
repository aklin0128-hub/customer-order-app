"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AnalyticsTableWrap } from "./admin-analytics-ui";

export type BuyerRow = {
  accountNo: string;
  totalQty: number;
  invoiceCount: number;
  latestPrice: number | null;
  latestDate: string;
};

export type SkuBuyersData = {
  buyerRows: BuyerRow[];
  skuProduct: { sku: string; name?: string; brand?: string; status?: string } | null;
};

export type PriceHistoryPoint = {
  accountNo: string;
  sku: string;
  invoiceNo: string | null;
  invoiceDate: string;
  uploadedAt: string;
  qty: number;
  price: number;
  importId: string;
};

export type AccountPriceRow = {
  sku: string;
  name: string;
  brand: string;
  status: string;
  latestPrice: number | null;
  previousPrice: number | null;
  changePct: number | null;
  latestDate: string;
  previousDate: string;
  invoiceNo: string;
  importId: string;
  history: PriceHistoryPoint[];
};

export type PriceComparePriceData = {
  accountRows: AccountPriceRow[];
  filters: {
    mode: string;
    accountNo: string;
    sku: string;
    days: number | null;
  };
  pointCount: number;
  pricedPointCount: number;
  importCount: number;
};

const thStyle: CSSProperties = {
  padding: 8,
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
};

const tdStyle: CSSProperties = { padding: 8 };

export function formatUnitPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `$${value.toFixed(2)}` : "-";
}

export function priceChangePct(current: number, previous: number) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function priceChangeBadgeStyle(pct: number | null): CSSProperties {
  if (pct === null) return { background: "#f3f4f6", color: "#6b7280" };
  if (pct > 0) return { background: "#fee2e2", color: "#b91c1c" };
  if (pct < 0) return { background: "#dcfce7", color: "#15803d" };
  return { background: "#f3f4f6", color: "#6b7280" };
}

export function invoiceFileUrl(fileName: string) {
  return `/api/admin/invoice-file?name=${encodeURIComponent(fileName)}`;
}

export function AdminSkuBuyersTable({
  rows,
  emptyMessage = "No buyers found for this SKU.",
}: {
  rows: BuyerRow[];
  emptyMessage?: string;
}) {
  if (!rows.length) {
    return <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>{emptyMessage}</p>;
  }

  return (
    <AnalyticsTableWrap>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle}>Account</th>
            <th style={thStyle}>Total Qty</th>
            <th style={thStyle}>Invoices</th>
            <th style={thStyle}>Latest Price</th>
            <th style={thStyle}>Latest Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ ...tdStyle, fontWeight: 900 }}>
                <Link href={`/admin/account?accountNo=${encodeURIComponent(row.accountNo)}`}>{row.accountNo}</Link>
              </td>
              <td style={{ ...tdStyle, fontWeight: 800 }}>{row.totalQty}</td>
              <td style={tdStyle}>{row.invoiceCount}</td>
              <td style={{ ...tdStyle, fontWeight: 800 }}>{formatUnitPrice(row.latestPrice)}</td>
              <td style={tdStyle}>{row.latestDate || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AnalyticsTableWrap>
  );
}

function PriceHistoryDetailTable({ history }: { history: PriceHistoryPoint[] }) {
  if (!history.length) {
    return <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>No invoice lines in range.</p>;
  }

  return (
    <AnalyticsTableWrap>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Unit Price</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Invoice</th>
            <th style={thStyle}>Change vs previous</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row, index) => {
            const prev = history[index + 1];
            const pct = prev ? priceChangePct(row.price, prev.price) : null;
            const date = row.invoiceDate || row.uploadedAt?.slice(0, 10) || "";
            return (
              <tr key={`${date}-${row.invoiceNo}-${index}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tdStyle}>{date}</td>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{formatUnitPrice(row.price)}</td>
                <td style={tdStyle}>{row.qty}</td>
                <td style={tdStyle}>{row.invoiceNo || row.importId || "-"}</td>
                <td style={tdStyle}>
                  {pct === null ? (
                    "-"
                  ) : (
                    <span
                      style={{
                        ...priceChangeBadgeStyle(pct),
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {pct > 0 ? "+" : ""}
                      {pct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </AnalyticsTableWrap>
  );
}

export function AdminAccountPriceRows({
  rows,
  expandedKey,
  onToggle,
}: {
  rows: AccountPriceRow[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
}) {
  if (!rows.length) {
    return <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>No matching purchase history.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((row) => {
        const key = row.sku;
        const expanded = expandedKey === key;
        const purchaseCount = row.history.length;
        const totalQty = row.history.reduce((sum, point) => sum + point.qty, 0);
        return (
          <div
            key={key}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              background: expanded ? "#f8fafc" : "#fff",
            }}
          >
            <button
              type="button"
              onClick={() => onToggle(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 14 }}>
                  {row.sku} · {row.name || "Unknown product"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {row.brand || "—"} · {row.status || "—"} · {purchaseCount} purchases · {totalQty} cases
                  {row.changePct !== null ? (
                    <>
                      {" "}
                      ·{" "}
                      <span style={priceChangeBadgeStyle(row.changePct)}>
                        {row.changePct > 0 ? "+" : ""}
                        {row.changePct.toFixed(1)}% vs prior
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900 }}>{formatUnitPrice(row.latestPrice)}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{row.latestDate}</div>
              </div>
            </button>
            {expanded ? (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid #e5e7eb" }}>
                <PriceHistoryDetailTable history={row.history} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminPriceSectionTabs({
  section,
  onSectionChange,
}: {
  section: "price" | "buyers";
  onSectionChange: (section: "price" | "buyers") => void;
}) {
  const tabStyle = (active: boolean): CSSProperties => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
    background: active ? "#eff6ff" : "#fff",
    color: active ? "#1d4ed8" : "#374151",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={tabStyle(section === "price")} onClick={() => onSectionChange("price")}>
        Account price history
      </button>
      <button type="button" style={tabStyle(section === "buyers")} onClick={() => onSectionChange("buyers")}>
        SKU top buyers
      </button>
    </div>
  );
}

export function AdminPriceEmptyHint({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
      {children}
    </p>
  );
}
