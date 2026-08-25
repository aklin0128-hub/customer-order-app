"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPage } from "../_components/AdminPage";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import {
  FieldLabel,
  FormSection,
  SalesListItem,
  inputStyle,
} from "../_components/admin-sales-ui";
import { splitForm, splitLayout } from "../_components/admin-styles";
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

type VegePearsRecord = {
  sku: string;
  note?: string;
  sortOrder?: number;
};

type VegePearsProduct = { sku: string; name?: string; brand?: string };

function emptyForm() {
  return { sku: "", note: "", sortOrder: "" };
}

export default function AdminVegePearsPage() {
  const { authed, adminHeaders } = useAdminAuth();

  const [records, setRecords] = useState<VegePearsRecord[]>([]);
  const [products, setProducts] = useState<VegePearsProduct[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [bulkSkuText, setBulkSkuText] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" } | null>(null);
  const bulkTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  };

  const productMap = useMemo(() => {
    const map = new Map<string, VegePearsProduct>();
    for (const p of products) map.set(String(p.sku || "").toUpperCase(), p);
    return map;
  }, [products]);

  const load = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/vege-pears", { headers: adminHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load Vege & Pears.");
      setRecords(Array.isArray(data.records) ? data.records : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setLoaded(true);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to load.", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!authed) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return records;
    return records.filter((r) => {
      const product = productMap.get(r.sku.toUpperCase());
      return (
        r.sku.includes(q) ||
        String(r.note || "")
          .toUpperCase()
          .includes(q) ||
        String(product?.name || "")
          .toUpperCase()
          .includes(q) ||
        String(product?.brand || "")
          .toUpperCase()
          .includes(q)
      );
    });
  }, [records, search, productMap]);

  const editRow = (record: VegePearsRecord) => {
    setForm({
      sku: record.sku,
      note: record.note || "",
      sortOrder: record.sortOrder !== undefined ? String(record.sortOrder) : "",
    });
  };

  const saveOne = async () => {
    const sku = form.sku.trim().toUpperCase();
    if (!sku) return notify("Enter a SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/vege-pears", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sku,
          note: form.note,
          sortOrder: form.sortOrder || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save.");
      setRecords(Array.isArray(data.records) ? data.records : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      setForm(emptyForm());
      notify(`Saved ${sku}`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to save.", "error");
    } finally {
      setBusy(false);
    }
  };

  const bulkAdd = async () => {
    const text = bulkSkuText.trim();
    if (!text) return notify("Paste at least one SKU.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/vege-pears", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to bulk add.");
      const parts = [`Added ${data.added?.length || 0}`];
      if (data.skippedExisting?.length) parts.push(`${data.skippedExisting.length} already listed`);
      if (data.missingCatalog?.length) {
        parts.push(`${data.missingCatalog.length} not in catalog (saved anyway)`);
      }
      notify(parts.join(" · "));
      setBulkSkuText("");
      setRecords(Array.isArray(data.records) ? data.records : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to bulk add.", "error");
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (targetSku: string) => {
    const sku = targetSku.trim().toUpperCase();
    if (!confirm(`Remove ${sku} from Vege & Pears?`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/vege-pears?sku=${encodeURIComponent(sku)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove.");
      if (form.sku === sku) setForm(emptyForm());
      setRecords(Array.isArray(data.records) ? data.records : []);
      setProducts(Array.isArray(data.products) ? data.products : []);
      notify(`Removed ${sku}`);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Failed to remove.", "error");
    } finally {
      setBusy(false);
    }
  };

  const editingSku = form.sku.trim().toUpperCase();

  return (
    <AdminPage
      active="vegePears"
      title="Vege & Pears"
      subtitle="Curate SKUs shown on the customer Vege & Pears tab. Add one by one or paste a list."
      actions={
        <>
          <BtnSecondary
            onClick={() => {
              bulkTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              bulkTextareaRef.current?.focus();
            }}
            disabled={busy}
          >
            Bulk add SKUs
          </BtnSecondary>
          <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
            + New SKU
          </BtnSecondary>
        </>
      }
    >
      <StatGrid
        items={[
          { label: "Listed SKUs", value: records.length },
          { label: "In catalog", value: products.filter((p) => p.name).length },
          {
            label: "Missing catalog",
            value: records.filter((r) => !productMap.get(r.sku.toUpperCase())?.name).length,
          },
        ]}
      />

      {!loaded && busy ? (
        <Panel title="Loading">
          <p style={{ margin: 0, fontSize: 13, color: "#15803d", fontWeight: 800 }}>Loading…</p>
        </Panel>
      ) : null}

      <div style={splitLayout} className="admin-catalog-split admin-split">
        <Panel title={`List (${filtered.length})`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, brand, note…"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div className="admin-split-list">
            {filtered.length === 0 ? (
              <EmptyState title="No SKUs yet" detail="Add produce SKUs on the right, or paste a bulk list below." />
            ) : (
              filtered.map((r) => {
                const product = productMap.get(r.sku.toUpperCase());
                return (
                  <SalesListItem
                    key={r.sku}
                    selected={editingSku === r.sku.toUpperCase()}
                    onClick={() => editRow(r)}
                    onRemove={() => removeRow(r.sku)}
                    removeDisabled={busy}
                  >
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{r.sku}</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "#4b5563" }}>
                      {product?.brand ? `${product.brand} · ` : ""}
                      {product?.name || "SKU not found in catalog"}
                    </div>
                    {r.note ? (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#4b5563" }}>{r.note}</div>
                    ) : null}
                    {typeof r.sortOrder === "number" ? (
                      <div style={{ marginTop: 2, fontSize: 11, color: "#6b7280" }}>
                        Sort: {r.sortOrder}
                      </div>
                    ) : null}
                  </SalesListItem>
                );
              })
            )}
          </div>
        </Panel>

        <div style={splitForm}>
          <Panel title={editingSku ? `Edit ${editingSku}` : "Add SKU"}>
            <FormSection title="Item" tone="accent">
              <FieldLabel>SKU</FieldLabel>
              <AdminSkuAutocomplete
                value={form.sku}
                onChange={(sku) => setForm((f) => ({ ...f, sku }))}
                disabled={busy}
              />
              <div style={{ marginTop: 10 }}>
                <FieldLabel>Note (optional)</FieldLabel>
                <input
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Shown under the card"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <FieldLabel>Sort order (optional)</FieldLabel>
                <input
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  placeholder="1 = first"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>
            </FormSection>
            <BtnRow>
              <BtnPrimary onClick={saveOne} disabled={busy}>
                Save
              </BtnPrimary>
              <BtnSecondary onClick={() => setForm(emptyForm())} disabled={busy}>
                Clear
              </BtnSecondary>
            </BtnRow>
          </Panel>

          <Panel title="Bulk add">
            <FieldLabel>Paste SKUs</FieldLabel>
            <textarea
              ref={bulkTextareaRef}
              value={bulkSkuText}
              onChange={(e) => setBulkSkuText(e.target.value)}
              placeholder={"80000V\n19610K\n01135D"}
              rows={6}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "ui-monospace, monospace" }}
            />
            <BtnRow>
              <BtnPrimary onClick={bulkAdd} disabled={busy}>
                Add SKUs
              </BtnPrimary>
            </BtnRow>
          </Panel>
        </div>
      </div>

      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </AdminPage>
  );
}
