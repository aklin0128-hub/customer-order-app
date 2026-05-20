"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { formatClearancePriceDisplay } from "@/lib/clearanceFormat";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import {
  FieldLabel,
  FormSection,
  SalesListItem,
  SkuPreview,
  StatusBadge,
  inputStyle,
} from "../_components/admin-sales-ui";
import { formGrid, splitForm, splitLayout, splitList } from "../_components/admin-styles";
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

type ClearanceStatus = "active" | "scheduled" | "expired" | "sold_out";
type StatusFilter = "all" | ClearanceStatus;

type ClearanceRecord = {
  sku: string;
  note?: string;
  expiryDate: string;
  clearancePrice: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  clearanceStatus?: ClearanceStatus;
};

type ClearanceProduct = { sku: string; name?: string; brand?: string };

const statusStyle: Record<ClearanceStatus, CSSProperties> = {
  active: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74" },
  scheduled: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
  expired: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  sold_out: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
};

const statusLabel: Record<ClearanceStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired / past date",
  sold_out: "Sold out",
};

function emptyForm() {
  return {
    sku: "",
    note: "Sell as is",
    expiryDate: "",
    clearancePrice: "",
    startDate: "",
    saleEndDate: "",
    clearanceQty: "",
    resetSoldQty: false,
  };
}

export default function AdminClearancePage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [clearances, setClearances] = useState<ClearanceRecord[]>([]);
  const [products, setProducts] = useState<ClearanceProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const productMap = useMemo(() => {
    const map = new Map<string, ClearanceProduct>();
    for (const p of products) map.set(p.sku.toUpperCase(), p);
    return map;
  }, [products]);

  const selectedProduct = productMap.get(form.sku.trim().toUpperCase()) ?? null;

  const filteredClearances = useMemo(() => {
    const q = search.trim().toUpperCase();
    return clearances
      .filter((p) => {
        const status = p.clearanceStatus || "active";
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (!q) return true;
        const product = productMap.get(p.sku.toUpperCase());
        return (
          p.sku.toUpperCase().includes(q) ||
          p.note?.toUpperCase().includes(q) ||
          product?.name?.toUpperCase().includes(q) ||
          product?.brand?.toUpperCase().includes(q)
        );
      })
      .sort((a, b) => (a.expiryDate || "9999-99-99").localeCompare(b.expiryDate || "9999-99-99"));
  }, [clearances, search, statusFilter, productMap]);

  const loadClearances = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clearance", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load clearance items.");
      setClearances(Array.isArray(data.clearances) ? data.clearances : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load clearance items.", "error");
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (authed) loadClearances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const editClearance = (record: ClearanceRecord) => {
    setForm({
      sku: record.sku,
      note: record.note || "Sell as is",
      expiryDate: record.expiryDate || "",
      clearancePrice: record.clearancePrice || "",
      startDate: record.startDate || "",
      saleEndDate: record.saleEndDate || "",
      clearanceQty: record.clearanceQty ? String(record.clearanceQty) : "",
      resetSoldQty: false,
    });
  };

  const saveClearance = async () => {
    const finalSku = form.sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter a SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/clearance", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sku: finalSku,
          note: form.note,
          expiryDate: form.expiryDate,
          clearancePrice: form.clearancePrice,
          startDate: form.startDate || undefined,
          saleEndDate: form.saleEndDate || undefined,
          clearanceQty: form.clearanceQty || undefined,
          resetSoldQty: form.resetSoldQty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save clearance item.");
      setForm(emptyForm());
      notify(`Saved clearance ${finalSku}`);
      await loadClearances();
    } catch (err: any) {
      notify(err?.message || "Failed to save clearance item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeClearance = async (targetSku: string) => {
    const finalSku = targetSku.trim().toUpperCase();
    if (!confirm(`Remove ${finalSku} from clearance list?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clearance?sku=${encodeURIComponent(finalSku)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove clearance item.");
      if (form.sku === finalSku) setForm(emptyForm());
      notify(`Removed ${finalSku}`);
      await loadClearances();
    } catch (err: any) {
      notify(err?.message || "Failed to remove clearance item.", "error");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = clearances.filter((p) => p.clearanceStatus === "active").length;
  const editingSku = form.sku.trim().toUpperCase();

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Clearance (Sell as is)"
        subtitle="Sign in to manage near-expiry items on the customer order page."
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
      active="clearance"
      title="Clearance — Sell as is"
      subtitle="Click a row to edit · form on the right. Same fields as before."
      onLogout={logout}
      actions={
        <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
          + New clearance
        </BtnSecondary>
      }
    >
      <StatGrid
        items={[
          { label: "Total listings", value: clearances.length },
          { label: "Live now", value: activeCount },
          { label: "Valid SKUs", value: products.length },
          {
            label: "Missing SKU",
            value: clearances.filter((p) => !productMap.has(p.sku.toUpperCase())).length,
          },
        ]}
      />

      {!loaded && busy ? (
        <Panel title="Loading clearance">
          <p style={{ margin: 0, fontSize: 13, color: "#c2410c", fontWeight: 800 }}>Loading…</p>
        </Panel>
      ) : null}

      <div style={splitLayout} className="admin-catalog-split admin-split">
        <Panel title={`List (${filteredClearances.length})`}>
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
            {filteredClearances.map((p) => {
              const product = productMap.get(p.sku.toUpperCase());
              const status = p.clearanceStatus || "active";
              const remaining =
                p.clearanceQty && p.clearanceQty > 0
                  ? Math.max(0, p.clearanceQty - (p.soldQty || 0))
                  : null;
              const price = p.clearancePrice ? formatClearancePriceDisplay(p.clearancePrice) : "";

              return (
                <SalesListItem
                  key={p.sku}
                  selected={editingSku === p.sku.toUpperCase()}
                  onClick={() => editClearance(p)}
                  onRemove={() => removeClearance(p.sku)}
                  removeDisabled={busy}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{p.sku}</strong>
                    <StatusBadge label={statusLabel[status]} style={statusStyle[status]} />
                  </div>
                  {p.note ? (
                    <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 800, marginTop: 2 }}>{p.note}</div>
                  ) : null}
                  {product ? (
                    <div className="admin-sales-list-summary">
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.name || "—"}
                    </div>
                  ) : (
                    <div className="admin-sales-list-summary" style={{ color: "#b91c1c", fontWeight: 700 }}>
                      SKU not in catalog
                    </div>
                  )}
                  {price ? <div className="admin-sales-list-deal">{price}</div> : null}
                  <div className="admin-sales-list-summary">
                    Expires {p.expiryDate}
                    {(p.startDate || p.saleEndDate) && (
                      <span>
                        {" "}
                        · List {p.startDate || "—"} → {p.saleEndDate || "—"}
                      </span>
                    )}
                    {p.clearanceQty
                      ? ` · Sold ${p.soldQty || 0}/${p.clearanceQty}${remaining !== null ? ` · left ${remaining}` : ""}`
                      : " · No stock cap"}
                  </div>
                </SalesListItem>
              );
            })}
            {loaded && filteredClearances.length === 0 ? (
              <EmptyState
                title={clearances.length === 0 ? "No clearance items yet" : "No matches"}
                detail={
                  clearances.length === 0
                    ? "Use + New clearance or enter a SKU on the right."
                    : "Try another search or filter."
                }
              />
            ) : null}
          </div>
        </Panel>

        <div style={splitForm} className="admin-catalog-form-sticky">
          <Panel title={editingSku ? `Edit ${editingSku}` : "Add clearance item"}>
            <FormSection title="SKU & label">
              <div style={formGrid}>
                <div>
                  <FieldLabel required>SKU</FieldLabel>
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                    placeholder="00003D"
                    style={inputStyle}
                    autoFocus={!editingSku}
                  />
                  <SkuPreview sku={form.sku} product={selectedProduct} />
                </div>
                <div>
                  <FieldLabel>Label / note</FieldLabel>
                  <input
                    value={form.note}
                    onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Sell as is / 临期特价"
                    style={inputStyle}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Pricing & expiry" hint="Required" tone="clearance">
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
                  <FieldLabel required>Clearance price</FieldLabel>
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
                <BtnPrimary onClick={saveClearance} disabled={busy}>
                  {busy ? "Saving…" : "Save clearance"}
                </BtnPrimary>
                <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
                  Clear
                </BtnSecondary>
                <BtnSecondary onClick={loadClearances} disabled={busy}>
                  Refresh
                </BtnSecondary>
              </BtnRow>
              <Toast message={msg} tone={msgTone} />
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
