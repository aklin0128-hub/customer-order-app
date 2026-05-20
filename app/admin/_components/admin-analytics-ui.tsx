"use client";

import type { CSSProperties, ReactNode } from "react";

export const analyticsTh: CSSProperties = {
  padding: 8,
  textAlign: "left",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 800,
  color: "#6b7280",
  whiteSpace: "nowrap",
};

export const analyticsTd: CSSProperties = { padding: 8, fontSize: 13 };

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyFmt2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatMoney(n: number, decimals = 0) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return decimals === 2 ? moneyFmt2.format(n) : moneyFmt.format(n);
}

export function formatGrowthPct(pct: number | null, current: number, previous: number) {
  if (previous === 0 && current > 0) return { text: "New", color: "#059669" };
  if (pct === null) return { text: "—", color: "#6b7280" };
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${pct.toFixed(1)}%`,
    color: pct >= 0 ? "#059669" : "#dc2626",
  };
}

export function GrowthCell({
  pct,
  current,
  previous,
  showDelta = true,
}: {
  pct: number | null;
  current: number;
  previous: number;
  showDelta?: boolean;
}) {
  const g = formatGrowthPct(pct, current, previous);
  return (
    <span style={{ fontWeight: 900, color: g.color }}>
      {g.text}
      {showDelta && previous > 0 ? (
        <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#9ca3af" }}>
          {previous.toLocaleString()} → {current.toLocaleString()}
        </span>
      ) : null}
    </span>
  );
}

export function PeriodBanner({
  current,
  previous,
}: {
  current: string;
  previous: string;
}) {
  return (
    <div className="admin-period-banner">
      <span>
        <strong>Current</strong> {current}
      </span>
      <span>
        <strong>vs</strong> {previous}
      </span>
    </div>
  );
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="admin-analytics-table-wrap" style={{ overflowX: "auto" }}>
      {children}
    </div>
  );
}
