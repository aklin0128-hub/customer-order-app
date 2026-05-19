"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import { StatGrid, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

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

export default function AdminTopSkusPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [days, setDays] = useState("");
  const [limit, setLimit] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<TopSkusData | null>(null);
  const [expandedSku, setExpandedSku] = useState("");

  const load = useCallback(async () => {
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
      setExpandedSku("");
    } catch (err: any) {
      setMsg(err?.message || "Failed to load top SKUs.");
    } finally {
      setBusy(false);
    }
  }, [adminHeaders, days, limit]);

  useEffect(() => {
    if (ready && authed) setPasswordInput("");
  }, [ready, authed]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  const downloadCsv = () => {
    if (!data?.rows.length) return;

    const header = ["Rank", "SKU", "Brand", "Name", "Status", "Total Qty", "Invoice Qty", "Order Qty", "Accounts", "Top Accounts"];
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

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Top SKUs"
        subtitle="Sign in to see best-selling SKUs across all accounts, invoices, and orders."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell
      active="topSkus"
      title="Top SKUs"
      subtitle="Ranked by total quantity from all uploaded invoices and all customer order history."
      onLogout={logout}
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Filters</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Date range</label>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="">All history</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Show top</label>
            <select value={limit} onChange={(e) => setLimit(e.target.value)} style={inputStyle}>
              <option value="50">50 SKUs</option>
              <option value="100">100 SKUs</option>
              <option value="200">200 SKUs</option>
              <option value="500">500 SKUs</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy}
              style={{
                flex: 1,
                minWidth: 120,
                border: "none",
                borderRadius: 10,
                padding: "11px 14px",
                background: busy ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Loading..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!data?.rows.length}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 10,
                padding: "11px 14px",
                background: "#fff",
                fontWeight: 800,
                cursor: data?.rows.length ? "pointer" : "not-allowed",
              }}
            >
              CSV
            </button>
          </div>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          Totals combine invoice line quantities and submitted order quantities. The same account may appear in both sources.
        </p>
      </section>

      {data ? (
        <>
          <StatGrid
            items={[
              { label: "SKUs with sales", value: data.summary.skuCount },
              { label: "Total cases", value: data.summary.totalQty },
              { label: "From invoices", value: data.summary.invoiceQty },
              { label: "From orders", value: data.summary.orderQty },
              { label: "Invoice files", value: data.summary.importCount },
              { label: "Order accounts", value: data.summary.orderAccountCount },
            ]}
          />

          <section style={panel}>
            <h2 style={panelTitle}>Ranking ({data.rows.length})</h2>
            {data.rows.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: 8, width: 48 }}>#</th>
                      <th style={{ padding: 8 }}>SKU</th>
                      <th style={{ padding: 8 }}>Product</th>
                      <th style={{ padding: 8 }}>Total qty</th>
                      <th style={{ padding: 8 }}>Invoice</th>
                      <th style={{ padding: 8 }}>Orders</th>
                      <th style={{ padding: 8 }}>Accounts</th>
                      <th style={{ padding: 8 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => {
                      const expanded = expandedSku === row.sku;
                      return (
                        <Fragment key={row.sku}>
                          <tr style={{ borderBottom: "1px solid #f3f4f6", background: expanded ? "#f8fafc" : undefined }}>
                            <td style={{ padding: 8, fontWeight: 900, color: "#6b7280" }}>{row.rank}</td>
                            <td style={{ padding: 8, fontWeight: 900 }}>{row.sku}</td>
                            <td style={{ padding: 8, maxWidth: 280 }}>
                              <div style={{ fontWeight: 700 }}>{row.name || "—"}</div>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>
                                {row.brand || "—"} · {row.status || "—"}
                              </div>
                            </td>
                            <td style={{ padding: 8, fontWeight: 900 }}>{row.totalQty}</td>
                            <td style={{ padding: 8 }}>{row.invoiceQty}</td>
                            <td style={{ padding: 8 }}>{row.orderQty}</td>
                            <td style={{ padding: 8 }}>{row.accountCount}</td>
                            <td style={{ padding: 8 }}>
                              {row.topAccounts.length ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedSku(expanded ? "" : row.sku)}
                                  style={{
                                    border: "1px solid #dbeafe",
                                    background: "#eff6ff",
                                    color: "#2563eb",
                                    borderRadius: 8,
                                    padding: "4px 8px",
                                    fontSize: 11,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  {expanded ? "Hide" : "Accounts"}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={8} style={{ padding: "0 8px 12px", background: "#f8fafc" }}>
                                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                                  <strong>Top accounts:</strong>{" "}
                                  {row.topAccounts.map((a) => `${a.accountNo} (${a.qty})`).join(" · ")}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontSize: 13 }}>No purchase data found for the selected period.</p>
            )}
          </section>
        </>
      ) : busy ? (
        <section style={panel}>
          <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading rankings...</p>
        </section>
      ) : null}
    </AdminShell>
  );
}

