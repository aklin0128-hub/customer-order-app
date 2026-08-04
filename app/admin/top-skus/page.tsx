"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AdminPage } from "../_components/AdminPage";
import { FieldLabel, inputStyle } from "../_components/admin-sales-ui";
import { panel, panelTitle } from "../_components/admin-styles";
import { BtnPrimary, BtnSecondary, Panel, StatGrid, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";
import { writeProductSheetImport } from "@/lib/productSheetImport";

type TopSkuRow = {
  rank: number;
  sku: string;
  name: string;
  brand: string;
  status: string;
  totalQty: number;
  invoiceQty: number;
  orderQty: number;
  accountCount: number;
  purchaseCount: number;
  topAccounts: { accountNo: string; qty: number }[];
};

type TopSkusData = {
  rows: TopSkuRow[];
  summary: {
    skuCount: number;
    totalQty: number;
    invoiceQty: number;
    orderQty: number;
    importCount: number;
    orderAccountCount: number;
    days: number | null;
    limit: number;
  };
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

function buyersHref(sku: string, days: string) {
  const params = new URLSearchParams({ section: "buyers", sku });
  if (days) params.set("days", days);
  return `/admin/price-compare?${params.toString()}`;
}

export default function AdminTopSkusPage() {
  const router = useRouter();
  const { authed, adminHeaders } = useAdminAuth();

  const [days, setDays] = useState("");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<TopSkusData | null>(null);

  const loadRanking = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      if (days) params.set("days", days);
      if (limit) params.set("limit", limit);

      const res = await fetch(`/api/admin/top-skus?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load top SKUs.");
      setData(json);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load top SKUs.";
      setMsg(message);
    } finally {
      setBusy(false);
    }
  }, [adminHeaders, days, limit]);

  useEffect(() => {
    if (authed) void loadRanking();
  }, [authed, loadRanking]);

  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(window.location.search);
    const daysParam = params.get("days");
    if (daysParam !== null && daysParam !== days) setDays(daysParam);

    const skuFromUrl = params.get("sku")?.trim().toUpperCase();
    if (skuFromUrl) {
      router.replace(buyersHref(skuFromUrl, daysParam || days), { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const downloadCsv = () => {
    if (!data?.rows.length) return;

    const header = [
      "Rank",
      "SKU",
      "Brand",
      "Name",
      "Status",
      "Total Qty",
      "Invoice Qty",
      "Order Qty",
      "Accounts",
      "Top Accounts",
    ];
    const lines = data.rows.map((row) => [
      row.rank,
      row.sku,
      row.brand,
      row.name,
      row.status,
      row.totalQty,
      row.invoiceQty,
      row.orderQty,
      row.accountCount,
      row.topAccounts.map((a) => `${a.accountNo}:${a.qty}`).join("; "),
    ]);

    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `top-skus${days ? `-${days}d` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendToProductSheet = () => {
    if (!data?.rows.length) return;
    writeProductSheetImport({
      source: "top-skus",
      days,
      limit,
      items: data.rows.map((row) => ({
        sku: row.sku,
        name: row.name,
        brand: row.brand,
      })),
      createdAt: new Date().toISOString(),
    });
    router.push("/admin/product-sheet?import=top-skus");
  };

  return (
    <AdminPage
      active="topSkus"
      title="Top SKUs"
      subtitle="Sales ranking by SKU. Open buyer breakdown in Price Compare."
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <FieldLabel>Date range</FieldLabel>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="">All history</option>
            </select>
          </div>
          <div>
            <FieldLabel>Show top</FieldLabel>
            <select value={limit} onChange={(e) => setLimit(e.target.value)} style={inputStyle}>
              <option value="50">50 SKUs</option>
              <option value="100">100 SKUs</option>
              <option value="200">200 SKUs</option>
              <option value="500">500 SKUs</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <BtnPrimary onClick={() => void loadRanking()} disabled={busy}>
              {busy ? "Loading…" : "Refresh ranking"}
            </BtnPrimary>
            <BtnSecondary onClick={downloadCsv} disabled={!data?.rows.length}>
              Export CSV
            </BtnSecondary>
            <BtnSecondary onClick={sendToProductSheet} disabled={!data?.rows.length || busy}>
              Send to Product Sheet
            </BtnSecondary>
            <Link
              href={`/admin/price-compare?section=buyers${days ? `&days=${days}` : ""}`}
              className="admin-btn admin-btn--secondary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            >
              SKU buyer lookup
            </Link>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          Totals combine invoice imports and submitted orders. Use <strong>Buyers</strong> to open the full account list in{" "}
          <Link href="/admin/price-compare?section=buyers">Price Compare</Link>.{" "}
          <strong>Send to Product Sheet</strong> opens a new sheet with these ranked SKUs for PDF.
        </p>
      </section>

      {data ? (
        <StatGrid
          items={[
            { label: "SKUs with sales", value: data.summary.skuCount },
            { label: "Total cases", value: data.summary.totalQty },
            { label: "From invoices", value: data.summary.invoiceQty },
            { label: "From orders", value: data.summary.orderQty },
          ]}
        />
      ) : null}

      <Panel title={`Ranking${data ? ` (${data.rows.length})` : ""}`}>
        {busy && !data ? (
          <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading ranking…</p>
        ) : data?.rows.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Inv</th>
                  <th style={thStyle}>Orders</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.sku} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ ...tdStyle, fontWeight: 900, color: "#6b7280" }}>{row.rank}</td>
                    <td style={{ ...tdStyle, fontWeight: 900 }}>{row.sku}</td>
                    <td style={{ ...tdStyle, maxWidth: 260 }}>
                      <div style={{ fontWeight: 700 }}>{row.name || "—"}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {row.brand || "—"} · {row.accountCount} accounts
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 900 }}>{row.totalQty}</td>
                    <td style={tdStyle}>{row.invoiceQty}</td>
                    <td style={tdStyle}>{row.orderQty}</td>
                    <td style={tdStyle}>
                      <Link href={buyersHref(row.sku, days)} className="admin-chip" style={{ textDecoration: "none" }}>
                        Buyers
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : data ? (
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>No purchase data for this period.</p>
        ) : null}
      </Panel>
    </AdminPage>
  );
}
