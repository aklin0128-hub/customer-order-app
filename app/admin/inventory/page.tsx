"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, labelStyle, panel, panelTitle } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type InventoryMeta = {
  uploadedAt: string;
  blobPathname: string;
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
};

type SkuLookupResult = {
  sku: string;
  found: boolean;
  lots: InventoryLot[];
  expireDates: string[];
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
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminInventoryPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [meta, setMeta] = useState<InventoryMeta | null>(null);
  const [loadedRows, setLoadedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
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
    const res = await fetch("/api/admin/inventory-by-item", {
      cache: "no-store",
      headers: adminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Failed to load inventory info.");
    setMeta(data.meta || null);
    setLoadedRows(Number(data.loadedRows) || 0);
  }, [adminHeaders]);

  useEffect(() => {
    if (authed) void loadMeta().catch((err: Error) => notify(err.message, "error"));
  }, [authed, loadMeta]);

  const upload = async () => {
    if (!file) {
      notify("Choose a CSV or Excel file first.", "error");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/admin/inventory-by-item", {
        method: "POST",
        headers: adminHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed.");

      setMeta(data.meta || null);
      setFile(null);
      notify(data.message || "Inventory file uploaded.");
      await loadMeta();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const searchSku = async () => {
    const q = sku.trim();
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

      const res = await fetch(`/api/admin/inventory-by-item?${params}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lookup failed.");

      setLookup({
        sku: data.sku,
        found: Boolean(data.found),
        lots: Array.isArray(data.lots) ? data.lots : [],
        expireDates: Array.isArray(data.expireDates) ? data.expireDates : [],
        earliestExpireDate: data.earliestExpireDate || null,
        latestExpireDate: data.latestExpireDate || null,
        totalOnHandQty: Number(data.totalOnHandQty) || 0,
      });
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Lookup failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Inventory expiry"
        subtitle="Upload weekly By Item CSV or Excel and look up SKU expiration dates."
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
      active="inventory"
      title="Inventory expiry"
      subtitle="Internal only — upload Friday By Item CSV or Excel. Stores do not see this."
      onLogout={logout}
    >
      <StatGrid
        items={[
          { label: "Last upload", value: meta ? formatUploadedAt(meta.uploadedAt) : "None" },
          { label: "Lots loaded", value: meta?.rowCount ?? loadedRows },
          { label: "Unique SKUs", value: meta?.skuCount ?? "—" },
          { label: "Source file", value: meta?.fileName || "—" },
        ]}
      />

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Panel title="Upload weekly file">
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.45 }}>
            Upload the <strong>By Item</strong> sheet as <strong>.xlsx</strong> or <strong>.csv</strong>.
            Column titles should match your export:
            <code>Loc Item</code>, <code>Loc Item Desc</code>, <code>Loc Qty UM</code>,{" "}
            <code>Loc Inventory Status</code>, <code>Loc Received Date</code>,{" "}
            <code>Loc Expire Date</code>, <code>Loc On Hand Qty</code>. Replaces the previous upload.
          </p>
          <label style={labelStyle}>CSV or Excel file</label>
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />
          <BtnRow>
            <BtnPrimary onClick={upload} disabled={busy || !file}>
              {busy ? "Uploading…" : "Upload file"}
            </BtnPrimary>
            <BtnSecondary onClick={() => void loadMeta()} disabled={busy}>
              Refresh
            </BtnSecondary>
          </BtnRow>
        </Panel>

        <Panel title="SKU lookup">
          <label style={labelStyle}>SKU</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void searchSku();
              }
            }}
            placeholder="e.g. 00002D or 000020"
            style={{ ...inputStyle, marginBottom: 10 }}
          />

          <label style={{ ...labelStyle, marginTop: 8 }}>Status filter (optional)</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          >
            <option value="">All statuses</option>
            <option value="Available">Available</option>
            <option value="Damaged">Damaged</option>
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
            <input type="checkbox" checked={onlyFuture} onChange={(e) => setOnlyFuture(e.target.checked)} />
            Only future expirations
          </label>

          <BtnPrimary onClick={searchSku} disabled={busy || !meta}>
            {busy ? "Searching…" : "Look up SKU"}
          </BtnPrimary>
          {!meta ? (
            <p style={{ fontSize: 12, color: "#b45309", marginTop: 10 }}>Upload a CSV before looking up SKUs.</p>
          ) : null}
        </Panel>
      </div>

      {lookup ? (
        <section style={panel}>
          <div style={panelTitle}>
            {lookup.found ? (
              <>
                {lookup.sku} · earliest {formatInventoryDate(lookup.earliestExpireDate || undefined)} · {lookup.lots.length} lot
                {lookup.lots.length === 1 ? "" : "s"} · on hand {lookup.totalOnHandQty}
              </>
            ) : (
              <>No lots for {lookup.sku}</>
            )}
          </div>

          {lookup.found ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ padding: "8px 10px" }}>SKU</th>
                    <th style={{ padding: "8px 10px" }}>Status</th>
                    <th style={{ padding: "8px 10px" }}>Received</th>
                    <th style={{ padding: "8px 10px" }}>Expires</th>
                    <th style={{ padding: "8px 10px" }}>On hand</th>
                    <th style={{ padding: "8px 10px" }}>UM</th>
                    <th style={{ padding: "8px 10px" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {lookup.lots.map((lot, i) => (
                    <tr key={`${lot.sku}-${i}`} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 800 }}>{lot.sku}</td>
                      <td style={{ padding: "8px 10px" }}>{lot.status || "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{formatInventoryDate(lot.receivedDate)}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700 }}>{formatInventoryDate(lot.expireDate)}</td>
                      <td style={{ padding: "8px 10px" }}>{lot.onHandQty ?? "—"}</td>
                      <td style={{ padding: "8px 10px" }}>{lot.qtyUm || "—"}</td>
                      <td style={{ padding: "8px 10px", color: "#4b5563" }}>{lot.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="SKU not in file" detail="Try catalog format (00002D) or inventory format (000020)." />
          )}
        </section>
      ) : null}

      <Toast message={msg} tone={msgTone} />
    </AdminShell>
  );
}
