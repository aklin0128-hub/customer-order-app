"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import { Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type PriceHistoryPoint = {
  accountNo: string;
  sku: string;
  invoiceNo: string | null;
  invoiceDate: string;
  qty: number;
  price: number;
  importId: string;
};

type AccountRow = {
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

type BuyerRow = {
  accountNo: string;
  totalQty: number;
  invoiceCount: number;
  latestPrice: number | null;
  latestDate: string;
};

type PriceCompareData = {
  accountRows: AccountRow[];
  buyerRows: BuyerRow[];
  skuProduct: { sku: string; name?: string; brand?: string; status?: string } | null;
  pointCount: number;
  importCount: number;
};

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? moneyFmt.format(value) : "-";
}

function pct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "NEW";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function pctStyle(value: number | null): CSSProperties {
  if (value === null) return { color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe" };
  if (value > 0.1) return { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca" };
  if (value < -0.1) return { color: "#047857", background: "#ecfdf5", border: "1px solid #a7f3d0" };
  return { color: "#4b5563", background: "#f3f4f6", border: "1px solid #d1d5db" };
}

function invoiceHref(importId: string) {
  return `/api/admin/invoice-file?id=${encodeURIComponent(importId)}`;
}

export default function AdminPriceComparePage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [priceAccountNo, setPriceAccountNo] = useState("");
  const [priceSku, setPriceSku] = useState("");
  const [priceDays, setPriceDays] = useState("");
  const [buyerSku, setBuyerSku] = useState("");
  const [buyerDays, setBuyerDays] = useState("180");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [priceData, setPriceData] = useState<PriceCompareData | null>(null);
  const [buyerData, setBuyerData] = useState<PriceCompareData | null>(null);
  const [expandedSku, setExpandedSku] = useState("");

  const loadPriceHistory = async () => {
    if (!priceAccountNo.trim() || !priceSku.trim()) {
      setMsg("Enter both account # and SKU for price history.");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      params.set("mode", "price");
      params.set("accountNo", priceAccountNo.trim().toUpperCase());
      params.set("sku", priceSku.trim().toUpperCase());
      if (priceDays) params.set("days", priceDays);

      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load price history.");
      setPriceData(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load price history.");
    } finally {
      setBusy(false);
    }
  };

  const loadTopBuyers = async () => {
    if (!buyerSku.trim()) {
      setMsg("Enter a SKU for top buyers.");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams();
      params.set("mode", "buyers");
      params.set("sku", buyerSku.trim().toUpperCase());
      if (buyerDays) params.set("days", buyerDays);

      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load top buyers.");
      setBuyerData(json);
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
        title="Price compare"
        subtitle="Sign in to compare invoice prices by account and SKU."
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
      active="priceCompare"
      title="Price Compare"
      subtitle="Two tools: account item price history, and SKU top buyers."
      onLogout={logout}
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>1. Account Item Price History</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280" }}>
          Use this to check one account's historical unit price for one SKU from uploaded invoices.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Account #</label>
            <input value={priceAccountNo} onChange={(e) => setPriceAccountNo(e.target.value.toUpperCase())} placeholder="FL111" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>SKU</label>
            <input value={priceSku} onChange={(e) => setPriceSku(e.target.value.toUpperCase())} placeholder="00003D" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date range</label>
            <select value={priceDays} onChange={(e) => setPriceDays(e.target.value)} style={inputStyle}>
              <option value="">All saved imports</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={() => void loadPriceHistory()}
              disabled={busy}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 10,
                padding: "11px 14px",
                background: busy ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Loading..." : "Load price history"}
            </button>
          </div>
        </div>
        {priceData ? (
          <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 13 }}>
            Found {priceData.pointCount} matching invoice lines from {priceData.importCount} saved imports.
          </p>
        ) : null}
      </section>

      {priceData?.accountRows.length ? (
        <section style={panel}>
          <h2 style={panelTitle}>Account Unit Price History</h2>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: 8 }}>SKU</th>
                  <th style={{ padding: 8 }}>Item</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Latest unit</th>
                  <th style={{ padding: 8 }}>Previous unit</th>
                  <th style={{ padding: 8 }}>Change</th>
                  <th style={{ padding: 8 }}>Dates</th>
                </tr>
              </thead>
              <tbody>
                {priceData.accountRows.map((row) => {
                  const expanded = expandedSku === row.sku;
                  return (
                    <Fragment key={row.sku}>
                      <tr key={row.sku} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 8, fontWeight: 900 }}>
                          <button type="button" onClick={() => setExpandedSku(expanded ? "" : row.sku)} style={{ border: "none", background: "transparent", color: "#2563eb", fontWeight: 900, cursor: "pointer", padding: 0 }}>
                            {row.sku}
                          </button>
                        </td>
                        <td style={{ padding: 8, minWidth: 220 }}>
                          <strong>{row.brand || "-"}</strong>
                          <div style={{ color: "#6b7280", marginTop: 2 }}>{row.name || "-"}</div>
                        </td>
                        <td style={{ padding: 8 }}>{row.status || "-"}</td>
                        <td style={{ padding: 8 }}>{money(row.latestPrice)}</td>
                        <td style={{ padding: 8 }}>{money(row.previousPrice)}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ ...pctStyle(row.changePct), borderRadius: 999, padding: "3px 8px", fontWeight: 900 }}>
                            {pct(row.changePct)}
                          </span>
                        </td>
                        <td style={{ padding: 8 }}>
                          {row.latestDate || "-"}
                          {row.previousDate ? ` / ${row.previousDate}` : ""}
                          {row.importId ? (
                            <>
                              {" · "}
                              <a href={invoiceHref(row.importId)} target="_blank" rel="noreferrer">invoice</a>
                            </>
                          ) : null}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${row.sku}-history`}>
                          <td colSpan={7} style={{ padding: 8, background: "#f9fafb" }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {row.history.map((point) => (
                                <span key={`${point.importId}-${point.price}-${point.qty}`} style={{ border: "1px solid #e5e7eb", borderRadius: 999, padding: "4px 8px", background: "#fff" }}>
                                  {point.invoiceDate}: {money(point.price)} x {point.qty}
                                </span>
                              ))}
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
        </section>
      ) : null}

      {priceData && priceData.accountRows.length === 0 ? (
        <section style={panel}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>No unit price history found for this account + SKU.</p>
        </section>
      ) : null}

      <section style={panel}>
        <h2 style={panelTitle}>2. SKU Top Buyers</h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280" }}>
          Use this to see which accounts bought this SKU the most in the selected period.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>SKU</label>
            <input value={buyerSku} onChange={(e) => setBuyerSku(e.target.value.toUpperCase())} placeholder="00003D" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date range</label>
            <select value={buyerDays} onChange={(e) => setBuyerDays(e.target.value)} style={inputStyle}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
              <option value="">All history</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              onClick={() => void loadTopBuyers()}
              disabled={busy}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 10,
                padding: "11px 14px",
                background: busy ? "#93c5fd" : "#0f766e",
                color: "#fff",
                fontWeight: 900,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Loading..." : "Load top buyers"}
            </button>
          </div>
        </div>
      </section>

      {buyerData?.skuProduct ? (
        <section style={panel}>
          <h2 style={panelTitle}>SKU Buyer Status</h2>
          <div style={{ fontSize: 14, color: "#374151", marginBottom: 10 }}>
            <strong>{buyerData.skuProduct.sku}</strong>
            {buyerData.skuProduct.brand ? ` · ${buyerData.skuProduct.brand}` : ""} · {buyerData.skuProduct.name || "-"} · Status:{" "}
            <strong>{buyerData.skuProduct.status || "Not found in catalog"}</strong>
          </div>
          {buyerData.buyerRows.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: 8 }}>Account</th>
                    <th style={{ padding: 8 }}>Total qty</th>
                    <th style={{ padding: 8 }}>Invoices</th>
                    <th style={{ padding: 8 }}>Latest unit price</th>
                    <th style={{ padding: 8 }}>Latest date</th>
                  </tr>
                </thead>
                <tbody>
                  {buyerData.buyerRows.map((row) => (
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
            <p style={{ color: "#6b7280", fontSize: 13 }}>
              No buyer history found for this SKU in the selected period.
            </p>
          )}
        </section>
      ) : null}
    </AdminShell>
  );
}
