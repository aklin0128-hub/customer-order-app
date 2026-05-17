"use client";

import { useEffect, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import { Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type BuyerRow = {
  accountNo: string;
  totalQty: number;
  invoiceCount: number;
  latestPrice: number | null;
  latestDate: string;
};

type SkuBuyersData = {
  buyerRows: BuyerRow[];
  skuProduct: { sku: string; name?: string; brand?: string; status?: string } | null;
};

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? moneyFmt.format(value) : "-";
}

export default function AdminSkuBuyersPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [sku, setSku] = useState("");
  const [days, setDays] = useState("180");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<SkuBuyersData | null>(null);

  const load = async () => {
    if (!sku.trim()) {
      setMsg("Enter a SKU.");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ mode: "buyers", sku: sku.trim().toUpperCase() });
      if (days) params.set("days", days);
      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, { cache: "no-store", headers: adminHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load top buyers.");
      setData(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load top buyers.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (ready && authed) setPasswordInput("");
  }, [ready, authed]);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="SKU Buyers"
        subtitle="Sign in to see which accounts buy a SKU the most."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell active="skuBuyers" title="SKU Buyers" subtitle="See which accounts bought one SKU the most in a selected period." onLogout={logout}>
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>SKU Top Buyers</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="06194C" style={inputStyle} />
          </div>
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
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => void load()} disabled={busy} style={{ width: "100%", border: "none", borderRadius: 10, padding: "11px 14px", background: busy ? "#99f6e4" : "#0f766e", color: "#fff", fontWeight: 900, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Loading..." : "Load top buyers"}
            </button>
          </div>
        </div>
      </section>

      {data?.skuProduct ? (
        <section style={panel}>
          <h2 style={panelTitle}>Buyer Ranking</h2>
          <div style={{ fontSize: 14, color: "#374151", marginBottom: 10 }}>
            <strong>{data.skuProduct.sku}</strong>
            {data.skuProduct.brand ? ` · ${data.skuProduct.brand}` : ""} · {data.skuProduct.name || "-"} · Status:{" "}
            <strong>{data.skuProduct.status || "Not found in catalog"}</strong>
          </div>
          {data.buyerRows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: 8 }}>Account</th>
                    <th style={{ padding: 8 }}>Total qty</th>
                    <th style={{ padding: 8 }}>Orders / invoices</th>
                    <th style={{ padding: 8 }}>Latest unit price</th>
                    <th style={{ padding: 8 }}>Latest date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.buyerRows.map((row) => (
                    <tr key={row.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: 8, fontWeight: 900 }}>{row.accountNo}</td>
                      <td style={{ padding: 8 }}>{row.totalQty}</td>
                      <td style={{ padding: 8 }}>{row.invoiceCount}</td>
                      <td style={{ padding: 8 }}>{money(row.latestPrice)}</td>
                      <td style={{ padding: 8 }}>{row.latestDate || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#6b7280", fontSize: 13 }}>No buyer history found for this SKU in the selected period.</p>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}
