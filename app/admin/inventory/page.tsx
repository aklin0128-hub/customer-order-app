"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPage } from "../_components/AdminPage";
import { AdminDataTable } from "../_components/AdminDataTable";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
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
  location?: string;
  licensePlate?: string;
  sourceLine?: number;
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
  const { authed, adminHeaders } = useAdminAuth();

  const [meta, setMeta] = useState<InventoryMeta | null>(null);
  const [statusEtaMeta, setStatusEtaMeta] = useState<InventoryMeta | null>(null);
  const [loadedRows, setLoadedRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [statusEtaFile, setStatusEtaFile] = useState<File | null>(null);
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

    try {
      const etaRes = await fetch("/api/admin/inventory-status-eta", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const etaData = await etaRes.json();
      if (etaRes.ok) setStatusEtaMeta(etaData.meta || null);
    } catch {
      /* optional second dataset */
    }
  }, [adminHeaders]);

  useEffect(() => {
    if (authed) void loadMeta().catch((err: Error) => notify(err.message, "error"));
  }, [authed, loadMeta]);

  useEffect(() => {
    if (!authed || !meta) return;
    const fromUrl = new URLSearchParams(window.location.search).get("sku")?.trim();
    if (!fromUrl) return;
    setSku(fromUrl.toUpperCase());
    void (async () => {
      setBusy(true);
      setLookup(null);
      try {
        const params = new URLSearchParams({ sku: fromUrl });
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, meta]);

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

  const uploadStatusEta = async () => {
    if (!statusEtaFile) {
      notify("Choose a status/ETA spreadsheet first.", "error");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", statusEtaFile);

      const res = await fetch("/api/admin/inventory-status-eta", {
        method: "POST",
        headers: adminHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed.");

      setStatusEtaMeta(data.meta || null);
      setStatusEtaFile(null);
      notify(data.message || "Status/ETA file uploaded.");
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

  return (
    <AdminPage
      active="inventory"
      title="Inventory expiry"
      subtitle="Internal only — upload Friday By Item CSV or Excel. Stores do not see this."
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
        <Panel title="Upload weekly By Item (expiry lots)">
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.45 }}>
            Upload the <strong>By Item</strong> sheet as <strong>.xlsx</strong> or <strong>.csv</strong>.
            Column titles should match your export:
            <code>Loc Item</code>, <code>Loc Item Desc</code>, <code>Loc Qty UM</code>,{" "}
            <code>Loc Inventory Status</code>, <code>Loc Received Date</code>,{" "}
            <code>Loc Expire Date</code>, <code>Loc On Hand Qty</code>. Replaces the previous upload. Rows with a
            blank <code>Loc Item</code> (merged cells in Excel) inherit the SKU from the row above. Rows with the same
            received and expire dates are merged and <strong>on hand</strong> quantities are summed. Re-upload after
            parser updates.
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

        <Panel title="Upload status + ETA (for /exp)">
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px", lineHeight: 1.45 }}>
            Spreadsheet for coworker <code>/exp</code> lookup. Columns:{" "}
            <code>PID</code>, <code>Description</code>, <code>Status</code> (or Stauts), <code>Aval. INV</code>,{" "}
            <code>Port ETA</code>, <code>Inbound QTY</code>. Continuation rows with blank PID inherit the product
            above. Last upload:{" "}
            <strong>{statusEtaMeta ? formatUploadedAt(statusEtaMeta.uploadedAt) : "None"}</strong>
            {statusEtaMeta ? ` · ${statusEtaMeta.skuCount} PIDs` : ""}.
          </p>
          <label style={labelStyle}>CSV or Excel file</label>
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => setStatusEtaFile(e.target.files?.[0] || null)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />
          <BtnRow>
            <BtnPrimary onClick={uploadStatusEta} disabled={busy || !statusEtaFile}>
              {busy ? "Uploading…" : "Upload status/ETA"}
            </BtnPrimary>
          </BtnRow>
        </Panel>

        <Panel title="SKU lookup">
          <label style={labelStyle}>SKU</label>
          <div style={{ marginBottom: 10 }}>
            <AdminSkuAutocomplete
              value={sku}
              onChange={setSku}
              includeInventory
              placeholder="e.g. 299 or 00002D"
              onEnter={() => void searchSku()}
            />
          </div>

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
            <AdminDataTable maxHeight="min(480px, 60vh)">
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
                  <tr key={`${lot.sku}-${lot.sourceLine ?? i}`}>
                    <td style={{ fontWeight: 800 }}>{lot.sku}</td>
                    <td>{lot.status || "—"}</td>
                    <td>{formatInventoryDate(lot.receivedDate)}</td>
                    <td style={{ fontWeight: 700 }}>{formatInventoryDate(lot.expireDate)}</td>
                    <td>{lot.onHandQty ?? "—"}</td>
                    <td>{lot.location || "—"}</td>
                    <td>{lot.licensePlate || "—"}</td>
                    <td>{lot.qtyUm || "—"}</td>
                    <td style={{ color: "#4b5563" }}>{lot.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </AdminDataTable>
          ) : (
            <EmptyState title="SKU not in file" detail="Try catalog format (00002D) or inventory format (000020)." />
          )}
        </section>
      ) : null}

      <Toast message={msg} tone={msgTone} />
    </AdminPage>
  );
}
