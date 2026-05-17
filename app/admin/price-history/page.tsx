"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import { Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type PriceHistoryPoint = {
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
  importId: string;
  history: PriceHistoryPoint[];
};

type PriceHistoryData = {
  accountRows: AccountRow[];
  pointCount: number;
  importCount: number;
};

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

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

function changeFromPrevious(history: PriceHistoryPoint[], index: number) {
  const previous = history[index + 1];
  if (!previous) return null;
  return ((history[index].price - previous.price) / previous.price) * 100;
}

export default function AdminPriceHistoryPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [sku, setSku] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<PriceHistoryData | null>(null);
  const [expandedSku, setExpandedSku] = useState("");

  const load = async () => {
    if (!accountNo.trim() || !sku.trim()) {
      setMsg("Enter both account # and SKU.");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const params = new URLSearchParams({ mode: "price", accountNo: accountNo.trim().toUpperCase(), sku: sku.trim().toUpperCase() });
      if (days) params.set("days", days);
      const res = await fetch(`/api/admin/price-compare?${params.toString()}`, { cache: "no-store", headers: adminHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load price history.");
      setData(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load price history.");
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
        title="Price History"
        subtitle="Sign in to check account item unit price history."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell active="priceHistory" title="Price History" subtitle="Check one account's unit price history for one SKU." onLogout={logout}>
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Account + SKU</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Account #</label>
            <input value={accountNo} onChange={(e) => setAccountNo(e.target.value.toUpperCase())} placeholder="FL111" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="06194C" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Date range</label>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle}>
              <option value="">All saved imports</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
              <option value="365">Last 365 days</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" onClick={() => void load()} disabled={busy} style={{ width: "100%", border: "none", borderRadius: 10, padding: "11px 14px", background: busy ? "#93c5fd" : "#2563eb", color: "#fff", fontWeight: 900, cursor: busy ? "not-allowed" : "pointer" }}>
              {busy ? "Loading..." : "Load price history"}
            </button>
          </div>
        </div>
        {data ? <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 13 }}>Found {data.pointCount} matching invoice lines from {data.importCount} saved imports.</p> : null}
      </section>

      {data?.accountRows.length ? (
        <section style={panel}>
          <h2 style={panelTitle}>Latest Price Summary</h2>
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
                {data.accountRows.map((row) => {
                  const expanded = expandedSku === row.sku;
                  return (
                    <Fragment key={row.sku}>
                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 8 }}>
                          <button type="button" onClick={() => setExpandedSku(expanded ? "" : row.sku)} style={{ border: "none", background: "transparent", color: "#2563eb", fontWeight: 900, cursor: "pointer", padding: 0 }}>{row.sku}</button>
                        </td>
                        <td style={{ padding: 8, minWidth: 220 }}><strong>{row.brand || "-"}</strong><div style={{ color: "#6b7280", marginTop: 2 }}>{row.name || "-"}</div></td>
                        <td style={{ padding: 8 }}>{row.status || "-"}</td>
                        <td style={{ padding: 8 }}>{money(row.latestPrice)}</td>
                        <td style={{ padding: 8 }}>{money(row.previousPrice)}</td>
                        <td style={{ padding: 8 }}><span style={{ ...pctStyle(row.changePct), borderRadius: 999, padding: "3px 8px", fontWeight: 900 }}>{pct(row.changePct)}</span></td>
                        <td style={{ padding: 8 }}>{row.latestDate || "-"}{row.previousDate ? ` / ${row.previousDate}` : ""}{row.importId ? <> · <a href={invoiceHref(row.importId)} target="_blank" rel="noreferrer">invoice</a></> : null}</td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 8, background: "#f9fafb" }}>
                            <div style={{ fontWeight: 900, marginBottom: 8 }}>All invoice unit prices</div>
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff" }}>
                                <thead>
                                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                                    <th style={{ padding: 8 }}>Date</th>
                                    <th style={{ padding: 8 }}>Unit price</th>
                                    <th style={{ padding: 8 }}>Qty</th>
                                    <th style={{ padding: 8 }}>Change vs previous</th>
                                    <th style={{ padding: 8 }}>Invoice</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.history.map((point, historyIndex) => {
                                    const change = changeFromPrevious(row.history, historyIndex);
                                    return (
                                      <tr key={`${point.importId}-${point.price}-${point.qty}-${point.invoiceDate}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                        <td style={{ padding: 8 }}>{point.invoiceDate || "-"}</td>
                                        <td style={{ padding: 8, fontWeight: 900 }}>{money(point.price)}</td>
                                        <td style={{ padding: 8 }}>{point.qty}</td>
                                        <td style={{ padding: 8 }}>
                                          <span style={{ ...pctStyle(change), borderRadius: 999, padding: "3px 8px", fontWeight: 900 }}>
                                            {historyIndex === row.history.length - 1 ? "First" : pct(change)}
                                          </span>
                                        </td>
                                        <td style={{ padding: 8 }}>
                                          {point.importId ? <a href={invoiceHref(point.importId)} target="_blank" rel="noreferrer">open</a> : "-"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
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

      {data && data.accountRows.length === 0 ? (
        <section style={panel}>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>No unit price history found for this account + SKU.</p>
        </section>
      ) : null}
    </AdminShell>
  );
}
