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

type StatusEtaMeta = {
  uploadedAt: string;
  rowCount: number;
  skuCount: number;
  fileName?: string;
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

type StatusEtaLookup = {
  pid: string;
  found: boolean;
  product: StatusEtaProduct | null;
};

type ResultTab = "exp" | "eta";

function formatInventoryDate(iso?: string | null) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${String(y).slice(-2)}`;
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

  const [meta, setMeta] = useState<StatusEtaMeta | null>(null);
  const [sku, setSku] = useState("");
  const [lookup, setLookup] = useState<StatusEtaLookup | null>(null);
  const [tab, setTab] = useState<ResultTab>("exp");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/exp/status-eta", { cache: "no-store", headers: expHeaders() });
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
      setTab("exp");
      try {
        const params = new URLSearchParams({ sku: q });
        const res = await fetch(`/api/exp/status-eta?${params}`, {
          cache: "no-store",
          headers: expHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Lookup failed.");

        setLookup({
          pid: data.pid,
          found: Boolean(data.found),
          product: data.product || null,
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
    [sku, expHeaders]
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
          <h1 style={loginTitle}>Inventory status</h1>
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

  const product = lookup?.product;
  const earliestEta = product?.inbound
    .map((x) => x.portEta)
    .filter(Boolean)
    .sort()[0];

  return (
    <div className="exp-page">
      <header className="exp-header">
        <div className="exp-header-inner">
          <div>
            <h1>Inventory status &amp; ETA</h1>
            <p>
              Look up PID status / available inventory and inbound Port ETA. Data updates when admin uploads
              the status+ETA spreadsheet.
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
            <div className="exp-stat-label">Rows in file</div>
            <div className="exp-stat-value">{meta?.rowCount?.toLocaleString() ?? "—"}</div>
          </div>
          <div className="exp-stat">
            <div className="exp-stat-label">Unique PIDs</div>
            <div className="exp-stat-value">{meta?.skuCount?.toLocaleString() ?? "—"}</div>
          </div>
        </div>

        <section className="exp-card">
          <h2>Look up SKU / PID</h2>
          <label className="exp-label">SKU or product name</label>
          <ExpSkuAutocomplete
            value={sku}
            onChange={setSku}
            onPick={(row) => void searchSku(row.sku)}
            placeholder="e.g. 06622T or COCONUT"
            disabled={busy || !meta}
            onEnter={() => void searchSku()}
          />

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
              No status/ETA file loaded yet. Ask admin to upload the spreadsheet (PID, Description, Status,
              Aval. INV, Port ETA, Inbound QTY).
            </p>
          ) : (
            <p className="exp-note">
              After search, switch between <strong>EXP status</strong> and <strong>ETA status</strong>. Share a
              link with <code>?sku=06622T</code>.
            </p>
          )}
        </section>

        {lookup ? (
          <section className="exp-card">
            {lookup.found && product ? (
              <>
                <p className="exp-result-title">
                  {product.pid} · {product.status || "—"} · Aval. INV {formatInv(product.availableInv)}
                  {earliestEta ? ` · next ETA ${formatInventoryDate(earliestEta)}` : ""}
                </p>

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
                      {tab === "exp" ? (
                        <tr>
                          <td style={{ fontWeight: 800 }}>{product.pid}</td>
                          <td>{product.description || "—"}</td>
                          <td>{product.status || "—"}</td>
                          <td style={{ fontWeight: 700 }}>{formatInv(product.availableInv)}</td>
                          <td>{formatInventoryDate(earliestEta)}</td>
                          <td>
                            {product.inbound.length
                              ? formatInv(
                                  product.inbound.reduce((sum, lot) => sum + (lot.inboundQty || 0), 0)
                                )
                              : "—"}
                          </td>
                        </tr>
                      ) : product.inbound.length > 0 ? (
                        product.inbound.map((lot, i) => (
                          <tr key={`${product.pid}-eta-${i}`}>
                            <td style={{ fontWeight: 800 }}>{product.pid}</td>
                            <td>{product.description || "—"}</td>
                            <td>{product.status || "—"}</td>
                            <td>{formatInv(product.availableInv)}</td>
                            <td style={{ fontWeight: 700 }}>{formatInventoryDate(lot.portEta)}</td>
                            <td style={{ fontWeight: 700 }}>{formatInv(lot.inboundQty)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", color: "#6b7280" }}>
                            No inbound ETA rows for this PID.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="exp-empty">
                <strong>No rows for {lookup.pid}</strong>
                <p style={{ margin: "8px 0 0" }}>Try the PID from the spreadsheet (e.g. 06622T).</p>
              </div>
            )}
          </section>
        ) : null}
      </main>

      {msg ? <div className={`exp-toast is-${msgTone}`}>{msg}</div> : null}
    </div>
  );
}
