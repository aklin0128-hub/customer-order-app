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

type ExpLookupResult = {
  sku: string;
  found: boolean;
  lots: InventoryLot[];
  earliestExpireDate: string | null;
  latestExpireDate: string | null;
  totalOnHandQty: number;
};

type StatusEtaInbound = {
  portEta: string | null;
  inboundQty: number | null;
};

type StatusEtaProduct = {
  pid: string;
  description: string;
  status: string;
  availableInv: number | null;
  inbound: StatusEtaInbound[];
};

type EtaLookupResult = {
  pid: string;
  found: boolean;
  product: StatusEtaProduct | null;
};

type ResultTab = "exp" | "eta";

function formatInventoryDate(iso?: string | null, shortYear = false) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return shortYear ? `${Number(m)}/${Number(d)}/${String(y).slice(-2)}` : `${Number(m)}/${Number(d)}/${y}`;
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

function formatInv(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

export default function ExpLookupPage() {
  const { ready, authed, error, loading, login, logout, expHeaders } = useExpAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [expMeta, setExpMeta] = useState<InventoryMeta | null>(null);
  const [etaMeta, setEtaMeta] = useState<InventoryMeta | null>(null);
  const [sku, setSku] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [onlyFuture, setOnlyFuture] = useState(false);
  const [expLookup, setExpLookup] = useState<ExpLookupResult | null>(null);
  const [etaLookup, setEtaLookup] = useState<EtaLookupResult | null>(null);
  const [tab, setTab] = useState<ResultTab>("exp");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [metaReady, setMetaReady] = useState(false);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadMeta = useCallback(async () => {
    const [expRes, etaRes] = await Promise.all([
      fetch("/api/exp/inventory", { cache: "no-store", headers: expHeaders() }),
      fetch("/api/exp/status-eta", { cache: "no-store", headers: expHeaders() }),
    ]);
    const expData = await expRes.json();
    if (!expRes.ok) throw new Error(expData?.error || "Failed to load expiry inventory.");
    setExpMeta(expData.meta || null);

    try {
      const etaData = await etaRes.json();
      if (etaRes.ok) setEtaMeta(etaData.meta || null);
      else setEtaMeta(null);
    } catch {
      setEtaMeta(null);
    }
    setMetaReady(true);
  }, [expHeaders]);

  const searchSku = useCallback(
    async (skuQuery?: string) => {
      const q = (skuQuery ?? sku).trim();
      if (!q) {
        notify("Enter a SKU.", "error");
        return;
      }

      setBusy(true);
      setExpLookup(null);
      setEtaLookup(null);
      setTab("exp");
      try {
        const expParams = new URLSearchParams({ sku: q });
        if (statusFilter) expParams.set("status", statusFilter);
        if (onlyFuture) expParams.set("onlyFuture", "1");

        const [expRes, etaRes] = await Promise.all([
          fetch(`/api/exp/inventory?${expParams}`, {
            cache: "no-store",
            headers: expHeaders(),
          }),
          fetch(`/api/exp/status-eta?${new URLSearchParams({ sku: q })}`, {
            cache: "no-store",
            headers: expHeaders(),
          }),
        ]);

        const expData = await expRes.json();
        if (!expRes.ok) throw new Error(expData?.error || "Expiry lookup failed.");

        setExpLookup({
          sku: expData.sku,
          found: Boolean(expData.found),
          lots: Array.isArray(expData.lots) ? expData.lots : [],
          earliestExpireDate: expData.earliestExpireDate || null,
          latestExpireDate: expData.latestExpireDate || null,
          totalOnHandQty: Number(expData.totalOnHandQty) || 0,
        });

        try {
          const etaData = await etaRes.json();
          if (etaRes.ok) {
            setEtaLookup({
              pid: etaData.pid,
              found: Boolean(etaData.found),
              product: etaData.product || null,
            });
          } else {
            setEtaLookup(null);
          }
        } catch {
          setEtaLookup(null);
        }

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
    if (!authed || !metaReady) return;
    const fromUrl = new URLSearchParams(window.location.search).get("sku")?.trim();
    if (!fromUrl) return;
    setSku(fromUrl.toUpperCase());
    void searchSku(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, metaReady]);

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

  const etaProduct = etaLookup?.product;
  const searched = expLookup !== null || etaLookup !== null;
  const canSearch = Boolean(expMeta || etaMeta);

  return (
    <div className="exp-page">
      <header className="exp-header">
        <div className="exp-header-inner">
          <div>
            <h1>Inventory expiry &amp; ETA</h1>
            <p>
              EXP status uses the weekly By Item expiry file. ETA status uses the inbound Port ETA spreadsheet.
              Switch tags after searching a SKU.
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
            <div className="exp-stat-label">EXP upload</div>
            <div className="exp-stat-value">{expMeta ? formatUploadedAt(expMeta.uploadedAt) : "—"}</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">EXP lots / SKUs</div>
            <div className="exp-stat-value">
              {expMeta
                ? `${expMeta.rowCount.toLocaleString()} / ${expMeta.skuCount.toLocaleString()}`
                : "—"}
            </div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">ETA upload</div>
            <div className="exp-stat-value">{etaMeta ? formatUploadedAt(etaMeta.uploadedAt) : "—"}</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">ETA PIDs</div>
            <div className="exp-stat-value">
              {etaMeta ? etaMeta.skuCount.toLocaleString() : "—"}
            </div>
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
            disabled={busy || !canSearch}
            onEnter={() => void searchSku()}
          />

          <div className="exp-filters">
            <div>
              <label className="exp-label">EXP status filter</label>
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
            disabled={busy || !canSearch}
          >
            {busy ? "Searching…" : "Search"}
          </button>

          {!expMeta && !etaMeta ? (
            <p className="exp-note" style={{ color: "#b45309" }}>
              No inventory files loaded yet. Ask admin to upload By Item (EXP) and/or status+ETA spreadsheet.
            </p>
          ) : (
            <p className="exp-note">
              After search, switch <strong>EXP status</strong> (expiry lots) and <strong>ETA status</strong>{" "}
              (inbound). Share a link with <code>?sku=10480K</code>.
              {!etaMeta ? " ETA file not uploaded yet." : ""}
              {!expMeta ? " EXP By Item file not uploaded yet." : ""}
            </p>
          )}
        </section>

        {searched ? (
          <section className="exp-card">
            <div className="exp-tabs" role="tablist" aria-label="Result view">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "exp"}
                className={`exp-tab${tab === "exp" ? " is-active" : ""}`}
                onClick={() => setTab("exp")}
              >
                EXP status
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "eta"}
                className={`exp-tab${tab === "eta" ? " is-active" : ""}`}
                onClick={() => setTab("eta")}
              >
                ETA status
              </button>
            </div>

            {tab === "exp" ? (
              expLookup?.found ? (
                <>
                  <p className="exp-result-title">
                    {expLookup.sku} · earliest{" "}
                    {formatInventoryDate(expLookup.earliestExpireDate)} · {expLookup.lots.length} lot
                    {expLookup.lots.length === 1 ? "" : "s"} · on hand{" "}
                    {expLookup.totalOnHandQty.toLocaleString()}
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
                        {expLookup.lots.map((lot, i) => (
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
                  <strong>No EXP lots for {expLookup?.sku || sku}</strong>
                  <p style={{ margin: "8px 0 0" }}>
                    {!expMeta
                      ? "Ask admin to upload the weekly By Item expiry file."
                      : "Try catalog SKU (e.g. 10480K) or inventory format (10480)."}
                  </p>
                </div>
              )
            ) : etaLookup?.found && etaProduct ? (
              <>
                <p className="exp-result-title">
                  {etaProduct.pid} · {etaProduct.status || "—"} · Aval. INV{" "}
                  {formatInv(etaProduct.availableInv)} · {etaProduct.inbound.length} inbound row
                  {etaProduct.inbound.length === 1 ? "" : "s"}
                </p>
                <div className="exp-table-wrap">
                  <table className="exp-table">
                    <thead>
                      <tr>
                        <th>PID</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Aval. INV</th>
                        <th>Port ETA</th>
                        <th>Inbound QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etaProduct.inbound.length > 0 ? (
                        etaProduct.inbound.map((lot, i) => (
                          <tr key={`${etaProduct.pid}-eta-${i}`}>
                            <td style={{ fontWeight: 800 }}>{etaProduct.pid}</td>
                            <td>{etaProduct.description || "—"}</td>
                            <td>{etaProduct.status || "—"}</td>
                            <td>{formatInv(etaProduct.availableInv)}</td>
                            <td style={{ fontWeight: 700 }}>
                              {formatInventoryDate(lot.portEta, true)}
                            </td>
                            <td style={{ fontWeight: 700 }}>{formatInv(lot.inboundQty)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={{ fontWeight: 800 }}>{etaProduct.pid}</td>
                          <td>{etaProduct.description || "—"}</td>
                          <td>{etaProduct.status || "—"}</td>
                          <td style={{ fontWeight: 700 }}>{formatInv(etaProduct.availableInv)}</td>
                          <td>—</td>
                          <td>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="exp-empty">
                <strong>No ETA rows for {etaLookup?.pid || sku}</strong>
                <p style={{ margin: "8px 0 0" }}>
                  {!etaMeta
                    ? "Ask admin to upload the status + ETA spreadsheet."
                    : "Try the PID from the ETA spreadsheet (e.g. 06622T)."}
                </p>
              </div>
            )}
          </section>
        ) : null}
      </main>

      {msg ? <div className={`exp-toast is-${msgTone}`}>{msg}</div> : null}
    </div>
  );
}
