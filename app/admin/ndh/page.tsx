"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatClearancePriceDisplay } from "@/lib/clearanceFormat";
import { AdminPage } from "../_components/AdminPage";
import { AdminPublicShowcaseHint } from "../_components/AdminPublicShowcaseHint";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import {
  FieldLabel,
  FormSection,
  SalesListItem,
  SkuPreview,
  StatusBadge,
  inputStyle,
} from "../_components/admin-sales-ui";
import { formGrid, splitForm, splitLayout } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  FilterChips,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type NdhStatus = "active" | "scheduled" | "expired" | "sold_out";
type StatusFilter = "all" | NdhStatus;

type NdhRecord = {
  sku: string;
  description?: string;
  note?: string;
  expiryDate: string;
  clearancePrice: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  clearanceStatus?: NdhStatus;
};

type NdhProduct = { sku: string; name?: string; brand?: string };

const statusStyle: Record<NdhStatus, CSSProperties> = {
  active: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74" },
  scheduled: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  expired: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  sold_out: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
};

const statusLabel: Record<NdhStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired / past date",
  sold_out: "Sold out",
};

function emptyForm() {
  return {
    sku: "",
    description: "",
    note: "Sell as is",
    expiryDate: "",
    clearancePrice: "",
    startDate: "",
    saleEndDate: "",
    clearanceQty: "",
    resetSoldQty: false,
  };
}

export default function AdminNdhPage() {
  const { authed, adminHeaders } = useAdminAuth();

  const [items, setItems] = useState<NdhRecord[]>([]);
  const [products, setProducts] = useState<NdhProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [catalogLookup, setCatalogLookup] = useState<NdhProduct | null>(null);
  const [listText, setListText] = useState("");
  const [listFile, setListFile] = useState<File | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const productMap = useMemo(() => {
    const map = new Map<string, NdhProduct>();
    for (const p of products) map.set(p.sku.toUpperCase(), p);
    return map;
  }, [products]);

  const selectedProduct = productMap.get(form.sku.trim().toUpperCase()) ?? catalogLookup;

  useEffect(() => {
    const clean = form.sku.trim().toUpperCase();
    if (!clean) {
      setCatalogLookup(null);
      return;
    }
    if (productMap.has(clean)) {
      setCatalogLookup(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/ndh?lookupSku=${encodeURIComponent(clean)}`, {
          cache: "no-store",
          headers: adminHeaders(),
        });
        const data = await res.json();
        if (!cancelled) {
          setCatalogLookup(res.ok && data.product ? (data.product as NdhProduct) : null);
        }
      } catch {
        if (!cancelled) setCatalogLookup(null);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.sku, productMap, adminHeaders]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toUpperCase();
    return items
      .filter((p) => {
        const status = p.clearanceStatus || "active";
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (!q) return true;
        const product = productMap.get(p.sku.toUpperCase());
        return (
          p.sku.toUpperCase().includes(q) ||
          p.note?.toUpperCase().includes(q) ||
          p.description?.toUpperCase().includes(q) ||
          p.expiryDate?.includes(q) ||
          product?.name?.toUpperCase().includes(q) ||
          product?.brand?.toUpperCase().includes(q)
        );
      })
      .sort((a, b) => (a.expiryDate || "9999-99-99").localeCompare(b.expiryDate || "9999-99-99"));
  }, [items, search, statusFilter, productMap]);

  const loadItems = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ndh", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load NDH.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setLoaded(true);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to load NDH.", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authed) void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const editItem = (record: NdhRecord) => {
    setForm({
      sku: record.sku,
      description: record.description || "",
      note: record.note || "Sell as is",
      expiryDate: record.expiryDate || "",
      clearancePrice: record.clearancePrice || "",
      startDate: record.startDate || "",
      saleEndDate: record.saleEndDate || "",
      clearanceQty: record.clearanceQty ? String(record.clearanceQty) : "",
      resetSoldQty: false,
    });
  };

  const saveItem = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ndh", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku,
          description: form.description,
          note: form.note,
          expiryDate: form.expiryDate,
          clearancePrice: form.clearancePrice,
          startDate: form.startDate,
          saleEndDate: form.saleEndDate,
          clearanceQty: form.clearanceQty || undefined,
          resetSoldQty: form.resetSoldQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save NDH item.");
      setItems(Array.isArray(data.items) ? data.items : []);
      notify(`Saved ${form.sku.trim().toUpperCase()}.`);
      await loadItems();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save NDH item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (sku: string, expiryDate?: string) => {
    if (!confirm(`Remove ${sku}${expiryDate ? ` exp ${expiryDate}` : ""} from NDH?`)) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({ sku });
      if (expiryDate) qs.set("expiryDate", expiryDate);
      const res = await fetch(`/api/admin/ndh?${qs.toString()}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete NDH item.");
      setItems(Array.isArray(data.items) ? data.items : []);
      if (form.sku.trim().toUpperCase() === sku.toUpperCase() && (!expiryDate || form.expiryDate === expiryDate)) {
        setForm(emptyForm());
      }
      notify(`Removed ${sku}${expiryDate ? ` ${expiryDate}` : ""}.`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to delete NDH item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadList = async () => {
    if (!listFile && !listText.trim()) {
      notify("Paste SKUs or choose a CSV/XLSX file.", "error");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (listFile) fd.set("file", listFile);
      fd.set("text", listText);
      fd.set("replaceAll", replaceAll ? "true" : "false");
      fd.set("clearancePrice", form.clearancePrice);
      fd.set("expiryDate", form.expiryDate);
      fd.set("clearanceQty", form.clearanceQty);
      fd.set("note", form.note || "Sell as is");

      const res = await fetch("/api/admin/ndh/upload", {
        method: "POST",
        headers: adminHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to upload NDH list.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setListText("");
      setListFile(null);
      const extra = data.errorCount ? `; ${data.errorCount} row(s) skipped` : "";
      notify(`Upload list: saved ${data.saved}${extra}.`);
      await loadItems();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to upload NDH list.", "error");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = items.filter((p) => p.clearanceStatus === "active").length;
  const editingSku = form.sku.trim().toUpperCase();

  return (
    <AdminPage
      active="ndh"
      title="NDH"
      subtitle="Upload a CSV/XLSX or paste SKUs. Live on /NDH and the customer order NDH tab."
    >
      <AdminPublicShowcaseHint variant="ndh" />
      <StatGrid
        items={[
          { label: "Total listings", value: items.length },
          { label: "Live now", value: activeCount },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: items.filter((p) => !productMap.has(p.sku.toUpperCase())).length,
          },
        ]}
      />

      <Panel title="Upload list">
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
          Use the warehouse CSV: <strong>PID</strong> (SKU), <strong>Description</strong>,{" "}
          <strong>Exp Date</strong>, <strong>Inv</strong>. Same SKU + same exp → Inv is added
          together. Same SKU + different exp → separate listings, each with its own Inv. Blank PID
          rows stay with the SKU above. TP is optional price.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setListFile(e.target.files?.[0] || null)}
          style={{ ...inputStyle, marginBottom: 8 }}
        />
        {listFile ? (
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Selected: {listFile.name}</div>
        ) : null}
        <textarea
          value={listText}
          onChange={(e) => setListText(e.target.value)}
          placeholder={"000150\n000160,8.99,2026-11-20,10"}
          rows={6}
          style={{ ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
        />
        <div className="admin-form-grid-2" style={{ marginBottom: 10 }}>
          <div>
            <FieldLabel>Default expiry (SKU-only rows)</FieldLabel>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <FieldLabel>Default NDH price</FieldLabel>
            <input
              value={form.clearancePrice}
              onChange={(e) => setForm((f) => ({ ...f, clearancePrice: e.target.value }))}
              placeholder="$8.99"
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Default stock qty (optional)</FieldLabel>
          <input
            value={form.clearanceQty}
            onChange={(e) => setForm((f) => ({ ...f, clearanceQty: e.target.value.replace(/[^0-9]/g, "") }))}
            placeholder="Empty = unlimited"
            inputMode="numeric"
            style={inputStyle}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          <input type="checkbox" checked={replaceAll} onChange={(e) => setReplaceAll(e.target.checked)} />
          Replace the whole NDH list (instead of merging by SKU + exp)
        </label>
        <BtnRow>
          <BtnPrimary onClick={() => void uploadList()} disabled={busy}>
            {busy ? "Uploading…" : "Upload list"}
          </BtnPrimary>
          <BtnSecondary
            onClick={() => {
              setListText("");
              setListFile(null);
            }}
            disabled={busy}
          >
            Clear list
          </BtnSecondary>
        </BtnRow>
      </Panel>

      {!loaded && busy ? (
        <Panel title="Loading NDH">
          <p style={{ margin: 0, fontSize: 13, color: "#c2410c", fontWeight: 800 }}>Loading…</p>
        </Panel>
      ) : null}

      <div style={splitLayout} className="admin-catalog-split admin-split">
        <Panel title={`List (${filteredItems.length})`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, brand…"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <FilterChips
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "scheduled", label: "Scheduled" },
              { id: "expired", label: "Expired" },
              { id: "sold_out", label: "Sold out" },
            ]}
          />
          <div className="admin-split-list">
            {filteredItems.map((p) => {
              const product = productMap.get(p.sku.toUpperCase());
              const status = p.clearanceStatus || "active";
              const remaining =
                p.clearanceQty && p.clearanceQty > 0 ? Math.max(0, p.clearanceQty - (p.soldQty || 0)) : null;
              const price = p.clearancePrice ? formatClearancePriceDisplay(p.clearancePrice) : "";

              return (
                <SalesListItem
                  key={`${p.sku}-${p.expiryDate}`}
                  selected={editingSku === p.sku.toUpperCase() && form.expiryDate === p.expiryDate}
                  onClick={() => editItem(p)}
                  onRemove={() => void removeItem(p.sku, p.expiryDate)}
                  removeDisabled={busy}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{p.sku}</strong>
                    <StatusBadge label={statusLabel[status]} style={statusStyle[status]} />
                  </div>
                  {p.description ? (
                    <div style={{ fontSize: 12, color: "#374151", fontWeight: 700, marginTop: 2 }}>{p.description}</div>
                  ) : null}
                  {p.note ? (
                    <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 800, marginTop: 2 }}>{p.note}</div>
                  ) : null}
                  {product ? (
                    <div className="admin-sales-list-summary">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.name || "—"}
                    </div>
                  ) : p.description ? null : (
                    <div className="admin-sales-list-summary" style={{ color: "#b91c1c", fontWeight: 700 }}>
                      SKU not in catalog
                    </div>
                  )}
                  {price ? <div className="admin-sales-list-deal">{price}</div> : null}
                  <div className="admin-sales-list-summary">
                    Expires {p.expiryDate}
                    {p.clearanceQty
                      ? ` · Sold ${p.soldQty || 0}/${p.clearanceQty}${remaining !== null ? ` · left ${remaining}` : ""}`
                      : " · No stock cap"}
                  </div>
                </SalesListItem>
              );
            })}
            {loaded && filteredItems.length === 0 ? (
              <EmptyState
                title={items.length === 0 ? "No NDH items yet" : "No matches"}
                detail={items.length === 0 ? "Upload a list or enter a SKU on the right." : "Try another search or filter."}
              />
            ) : null}
          </div>
        </Panel>

        <div style={splitForm} className="admin-catalog-form-sticky">
          <Panel title={editingSku ? `Edit ${editingSku}` : "Add / default for list upload"}>
            <FormSection title="SKU & label">
              <div style={formGrid}>
                <div>
                  <FieldLabel>SKU</FieldLabel>
                  <AdminSkuAutocomplete
                    value={form.sku}
                    onChange={(v) => setForm((f) => ({ ...f, sku: v }))}
                    placeholder="Type SKU or name…"
                  />
                  <SkuPreview sku={form.sku} product={selectedProduct} />
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="From CSV Description"
                    style={inputStyle}
                  />
                  <FieldLabel>Label / note</FieldLabel>
                  <input
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Sell as is"
                    style={inputStyle}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Pricing & expiry" hint="Exp required. Price optional (TP in CSV or default below)." tone="clearance">
              <div className="admin-form-grid-2">
                <div>
                  <FieldLabel required>Product expiry</FieldLabel>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>NDH price (optional)</FieldLabel>
                  <input
                    value={form.clearancePrice}
                    onChange={(e) => setForm((f) => ({ ...f, clearancePrice: e.target.value }))}
                    placeholder="$8.99"
                    style={inputStyle}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Listing window & stock" hint="Optional">
              <div className="admin-form-grid-2">
                <div>
                  <FieldLabel>Listing start</FieldLabel>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>Stop selling after</FieldLabel>
                  <input
                    type="date"
                    value={form.saleEndDate}
                    onChange={(e) => setForm((f) => ({ ...f, saleEndDate: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <FieldLabel>Stock qty</FieldLabel>
                <input
                  value={form.clearanceQty}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, clearanceQty: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  placeholder="Empty = unlimited"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>
            </FormSection>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              <input
                type="checkbox"
                checked={form.resetSoldQty}
                onChange={(e) => setForm((f) => ({ ...f, resetSoldQty: e.target.checked }))}
              />
              Reset sold count to 0 when saving
            </label>

            <div className="admin-form-actions-sticky">
              <BtnRow>
                <BtnPrimary onClick={() => void saveItem()} disabled={busy}>
                  {busy ? "Saving…" : "Save NDH item"}
                </BtnPrimary>
                <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
                  Clear
                </BtnSecondary>
                <BtnSecondary onClick={() => void loadItems()} disabled={busy}>
                  Refresh
                </BtnSecondary>
              </BtnRow>
              <Toast message={msg} tone={msgTone} />
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
