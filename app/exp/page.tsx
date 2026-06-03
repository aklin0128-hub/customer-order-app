"use client";

import { useCallback, useEffect, useState } from "react";

import {
  alertError,
  backLink,
  btnPrimary,
  inputStyle,
  labelStyle,
  loginCard,
  loginPage,
  loginSubtitle,
  loginTitle,
} from "../admin/_components/admin-styles";
import { ExpSkuAutocomplete } from "./ExpSkuAutocomplete";
import { useExpAuth } from "./useExpAuth";

type InventoryMeta = {
  uploadedAt: string;
  rowCount: number;
  skuCount: number;
  fileName?: string;
};

type InventoryLot = {
  sku: string;
  description?: string;
  qtyUm?: string;
  status?: string;
  receivedDate?: string;
  expireDate?: string;
  onHandQty?: number;
  location?: string;
  licensePlate?: string;
};

type SkuLookupResult = {
  sku: string;
  found: boolean;
  lots: InventoryLot[];
  earliestExpireDate: string | null;
  latestExpireDate: string | null;
  totalOnHandQty: number;
};

function formatInventoryDate(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function formatUploadedAt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExpLookupPage() {
  const { ready, authed, error, loading, login, logout, expHeaders } = useExpAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [meta, setMeta] = useState<InventoryMeta | null>(null);
  const [sku, setSku] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyFuture, setOnlyFuture] = useState(false);
  const [lookup, setLookup] = useState<SkuLookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/exp/inventory", { cache: "no-store", headers: expHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load inventory.");
    setMeta(data.meta || null);
  }, [expHeaders]);

  const searchSku = useCallback(
    async (skuQuery?: string) => {
      const q = (skuQuery ?? sku).trim();
      if (!q) {
        notify("Enter a SKU.", "error");
        return;
      }

      setBusy(true);
      setLookup(null);
      try {
        const params = new URLSearchParams({ sku: q });
        if (statusFilter) params.set("status", statusFilter);
        if (onlyFuture) params.set("onlyFuture", "1");

        const res = await fetch(`/api/exp/inventory?${params}`, {
          cache: "no-store",
          headers: expHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Lookup failed.");

        setLookup({
          sku: data.sku,
          found: Boolean(data.found),
          lots: Array.isArray(data.lots) ? data.lots : [],
          earliestExpireDate: data.earliestExpireDate || null,
          latestExpireDate: data.latestExpireDate || null,
          totalOnHandQty: Number(data.totalOnHandQty) || 0,
        });

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("sku", q);
          window.history.replaceState(null, "", url.pathname + url.search);
        }
      } catch (err: unknown) {
        notify(err instanceof Error ? err.message : "Lookup failed.", "error");
      } finally {
        setBusy(false);
      }
    },
    [sku, statusFilter, onlyFuture, expHeaders]
  );

  useEffect(() => {
    if (!authed) return;
    void loadMeta().catch((err: Error) => notify(err.message, "error"));
  }, [authed, loadMeta]);

  useEffect(() => {
    if (!authed || !meta) return;
    const fromUrl = new URLSearchParams(window.location.search).get("sku")?.trim();
    if (!fromUrl) return;
    setSku(fromUrl.toUpperCase());
    void searchSku(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, meta]);

  if (!ready) return null;

  if (!authed) {
    return (
      <main style={loginPage}>
        <section style={loginCard}>
          <div className="exp-login-logo">EXP</div>
          <h1 style={loginTitle}>Inventory expiry</h1>
          <p style={loginSubtitle}>
            Rheebros internal lookup — enter the team password shared by your manager. Read-only; does not
            change inventory data.
          </p>

          <label style={labelStyle}>Access password</label>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void login(passwordInput)}
            placeholder="Enter password"
            style={inputStyle}
            autoFocus
          />

          {error ? <div style={alertError}>{error}</div> : null}

          <button
            type="button"
            onClick={() => void login(passwordInput)}
            disabled={loading}
            style={{ ...btnPrimary, width: "100%", marginTop: 12, background: "#0d9488" }}
          >
            {loading ? "Signing in…" : "Continue"}
          </button>

          <a href="/" style={backLink}>
            Customer order site
          </a>
        </section>
      </main>
    );
  }

  return (
    <div className="exp-page">
      <header className="exp-header">
        <div className="exp-header-inner">
          <div>
            <h1>Inventory expiry lookup</h1>
            <p>
              Check received and expiration dates by SKU. Data is updated when admin uploads the weekly By
              Item file — you cannot upload here.
            </p>
          </div>
          <button type="button" className="exp-logout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="exp-main">
        <div className="exp-stats">
          <div className="exp-stat">
            <div className="exp-stat-label">Last data upload</div>
            <div className="exp-stat-value">{meta ? formatUploadedAt(meta.uploadedAt) : "—"}</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">Lots in file</div>
            <div className="exp-stat-value">{meta?.rowCount?.toLocaleString() ?? "—"}</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">Unique SKUs</div>
            <div className="exp-stat-value">{meta?.skuCount?.toLocaleString() ?? "—"}</div>
          </div>
        </div>

        <section className="exp-card">
          <h2>Look up SKU</h2>
          <label className="exp-label">SKU or product name</label>
          <ExpSkuAutocomplete
            value={sku}
            onChange={setSku}
            onPick={(row) => void searchSku(row.sku)}
            placeholder="e.g. 10480K or BULDAK"
            disabled={busy || !meta}
            onEnter={() => void searchSku()}
          />

          <div className="exp-filters">
            <div>
              <label className="exp-label">Status</label>
              <select
                className="exp-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="Available">Available</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <label className="exp-check">
              <input type="checkbox" checked={onlyFuture} onChange={(e) => setOnlyFuture(e.target.checked)} />
              Only future expirations
            </label>
          </div>

          <button
            type="button"
            className="exp-btn-primary"
            onClick={() => void searchSku()}
            disabled={busy || !meta}
          >
            {busy ? "Searching…" : "Search"}
          </button>

          {!meta ? (
            <p className="exp-note" style={{ color: "#b45309" }}>
              No inventory file loaded yet. Ask admin to upload the weekly report.
            </p>
          ) : (
            <p className="exp-note">
              Share a direct link: add <code>?sku=10480K</code> to the URL after searching once.
            </p>
          )}
        </section>

        {lookup ? (
          <section className="exp-card">
            {lookup.found ? (
              <>
                <p className="exp-result-title">
                  {lookup.sku} · earliest {formatInventoryDate(lookup.earliestExpireDate || undefined)} ·{" "}
                  {lookup.lots.length} lot{lookup.lots.length === 1 ? "" : "s"} · on hand{" "}
                  {lookup.totalOnHandQty.toLocaleString()}
                </p>
                <div className="exp-table-wrap">
                  <table className="exp-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Status</th>
                        <th>Received</th>
                        <th>Expires</th>
                        <th>On hand</th>
                        <th>Location</th>
                        <th>LPN</th>
                        <th>UM</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lookup.lots.map((lot, i) => (
                        <tr key={`${lot.sku}-${i}`}>
                          <td style={{ fontWeight: 800 }}>{lot.sku}</td>
                          <td>{lot.status || "—"}</td>
                          <td>{formatInventoryDate(lot.receivedDate)}</td>
                          <td style={{ fontWeight: 700 }}>{formatInventoryDate(lot.expireDate)}</td>
                          <td>{lot.onHandQty ?? "—"}</td>
                          <td>{lot.location || "—"}</td>
                          <td>{lot.licensePlate || "—"}</td>
                          <td>{lot.qtyUm || "—"}</td>
                          <td>{lot.description || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="exp-empty">
                <strong>No lots for {lookup.sku}</strong>
                <p style={{ margin: "8px 0 0" }}>Try catalog SKU (e.g. 10480K) or inventory format (10480).</p>
              </div>
            )}
          </section>
        ) : null}
      </main>

      {msg ? <div className={`exp-toast is-${msgTone}`}>{msg}</div> : null}
    </div>
  );
}
