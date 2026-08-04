"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminAccountAutocomplete } from "../_components/AdminAccountAutocomplete";
import { AdminPage } from "../_components/AdminPage";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import { ProductImage } from "@/app/order/components/ProductImage";
import { FieldLabel, inputStyle } from "../_components/admin-sales-ui";
import { formGrid, splitForm, splitLayout, splitList } from "../_components/admin-styles";
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

type SheetItem = { sku: string; note?: string; name?: string; brand?: string; imageUrl?: string };

type ProductSheet = {
  id: string;
  title: string;
  customerLabel?: string;
  accountNo?: string;
  note?: string;
  showPrice?: boolean;
  items: SheetItem[];
  updatedAt: string;
  createdAt: string;
};

function emptySheet(): Omit<ProductSheet, "id" | "createdAt" | "updatedAt"> & { id?: string } {
  return {
    title: "Product picks",
    customerLabel: "",
    accountNo: "",
    note: "",
    showPrice: false,
    items: [],
  };
}

export default function AdminProductSheetPage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [sheets, setSheets] = useState<ProductSheet[]>([]);
  const [form, setForm] = useState(emptySheet());
  const [skuDraft, setSkuDraft] = useState("");
  const [itemNoteDraft, setItemNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadSheets = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch("/api/admin/product-sheets", { headers: adminHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load sheets.");
      setSheets(Array.isArray(data.sheets) ? data.sheets : []);
      setLoaded(true);
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Failed to load sheets.", "error");
      setLoaded(true);
    }
  }, [authed, adminHeaders]);

  useEffect(() => {
    void loadSheets();
  }, [loadSheets]);

  const filteredSheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheets;
    return sheets.filter((sheet) => {
      const hay = [sheet.title, sheet.customerLabel, sheet.accountNo, sheet.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q) || sheet.items.some((item) => item.sku.toLowerCase().includes(q));
    });
  }, [sheets, search]);

  const addSku = (sku: string, name?: string, brand?: string) => {
    const clean = sku.trim().toUpperCase();
    if (!clean) return;
    setForm((prev) => {
      if (prev.items.some((item) => item.sku === clean)) {
        notify(`${clean} is already on this sheet.`, "error");
        return prev;
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            sku: clean,
            note: itemNoteDraft.trim() || undefined,
            name,
            brand,
            imageUrl: `/product/${clean}.jpg`,
          },
        ],
      };
    });
    setSkuDraft("");
    setItemNoteDraft("");
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev.items];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return { ...prev, items: next };
    });
  };

  const removeItem = (sku: string) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.sku !== sku) }));
  };

  const selectSheet = (sheet: ProductSheet) => {
    setForm({
      id: sheet.id,
      title: sheet.title,
      customerLabel: sheet.customerLabel || "",
      accountNo: sheet.accountNo || "",
      note: sheet.note || "",
      showPrice: Boolean(sheet.showPrice),
      items: sheet.items.map((item) => ({
        ...item,
        imageUrl: item.imageUrl || `/product/${item.sku}.jpg`,
      })),
    });
  };

  const startNew = () => setForm(emptySheet());

  const payload = () => ({
    id: form.id,
    title: form.title,
    customerLabel: form.customerLabel,
    accountNo: form.accountNo,
    note: form.note,
    showPrice: Boolean(form.showPrice),
    items: form.items.map((item) => ({ sku: item.sku, note: item.note })),
  });

  const saveSheet = async () => {
    if (!form.title.trim()) {
      notify("Title is required.", "error");
      return;
    }
    if (!form.items.length) {
      notify("Add at least one product.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/product-sheets", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Save failed.");
      setForm({
        ...data.sheet,
        customerLabel: data.sheet.customerLabel || "",
        accountNo: data.sheet.accountNo || "",
        note: data.sheet.note || "",
        items: (data.sheet.items || []).map((item: SheetItem) => ({
          ...item,
          imageUrl: `/product/${item.sku}.jpg`,
        })),
      });
      notify("Sheet saved.");
      await loadSheets();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteSheet = async () => {
    if (!form.id) {
      startNew();
      return;
    }
    if (!window.confirm("Delete this saved sheet?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/product-sheets?id=${encodeURIComponent(form.id)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Delete failed.");
      notify("Sheet deleted.");
      startNew();
      await loadSheets();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!form.items.length) {
      notify("Add at least one product.", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/product-sheets/pdf", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "PDF generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match?.[1] || "product-sheet.pdf";
      a.click();
      URL.revokeObjectURL(url);
      notify("PDF downloaded.");
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "PDF generation failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      active="productSheet"
      title="Product Sheet PDF"
      subtitle="Pick and arrange products, save sheets per customer, download PDF."
    >
      {msg ? <Toast message={msg} tone={msgTone} /> : null}

      <StatGrid
        items={[
          { label: "Saved sheets", value: String(sheets.length) },
          { label: "Products on this sheet", value: String(form.items.length) },
          { label: "Editing", value: form.id ? "Saved" : "New" },
        ]}
      />

      <div style={splitLayout}>
        <div style={splitList}>
          <Panel title="Saved sheets">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved sheets…"
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <BtnRow>
              <BtnSecondary onClick={startNew} disabled={busy}>
                New sheet
              </BtnSecondary>
              <BtnSecondary onClick={() => void loadSheets()} disabled={busy}>
                Refresh
              </BtnSecondary>
            </BtnRow>
            {!loaded ? <EmptyState title="Loading…" /> : null}
            {loaded && filteredSheets.length === 0 ? <EmptyState title="No saved sheets yet." /> : null}
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {filteredSheets.map((sheet) => {
                const active = sheet.id === form.id;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => selectSheet(sheet)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid #0f766e" : "1px solid #e5e7eb",
                      background: active ? "#ecfdf5" : "#fff",
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{sheet.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {[sheet.customerLabel, sheet.accountNo, `${sheet.items.length} SKUs`]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div style={splitForm}>
          <Panel title={form.id ? "Edit sheet" : "New sheet"}>
            <div style={formGrid}>
              <label>
                <FieldLabel>Title</FieldLabel>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  style={inputStyle}
                  placeholder="e.g. Spring picks for ABC"
                />
              </label>
              <label>
                <FieldLabel>Customer label</FieldLabel>
                <input
                  value={form.customerLabel || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, customerLabel: e.target.value }))}
                  style={inputStyle}
                  placeholder="Store / contact name on PDF"
                />
              </label>
              <label>
                <FieldLabel>Account # (optional)</FieldLabel>
                <AdminAccountAutocomplete
                  value={form.accountNo || ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, accountNo: v }))}
                  onPick={(row) =>
                    setForm((prev) => ({
                      ...prev,
                      accountNo: row.accountNo,
                      customerLabel: prev.customerLabel || row.storeName,
                    }))
                  }
                  placeholder="Link a customer account…"
                />
              </label>
              <label>
                <FieldLabel>Sheet note</FieldLabel>
                <input
                  value={form.note || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                  style={inputStyle}
                  placeholder="Shown under the PDF title"
                />
              </label>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                fontSize: 13,
                fontWeight: 700,
                color: "#374151",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(form.showPrice)}
                onChange={(e) => setForm((prev) => ({ ...prev, showPrice: e.target.checked }))}
              />
              Show catalog BP price on PDF
            </label>

            <div style={{ marginTop: 18 }}>
              <FieldLabel>Add product</FieldLabel>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1.4fr 1fr auto", alignItems: "end" }}>
                <AdminSkuAutocomplete
                  value={skuDraft}
                  onChange={setSkuDraft}
                  onPick={(row) => addSku(row.sku, row.name)}
                  placeholder="Search SKU or name…"
                />
                <input
                  value={itemNoteDraft}
                  onChange={(e) => setItemNoteDraft(e.target.value)}
                  style={inputStyle}
                  placeholder="Optional item note"
                />
                <BtnSecondary
                  onClick={() => addSku(skuDraft)}
                  disabled={busy || !skuDraft.trim()}
                >
                  Add
                </BtnSecondary>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
              {form.items.length === 0 ? (
                <EmptyState title="Add products in the order you want them on the PDF." />
              ) : null}
              {form.items.map((item, index) => (
                <div
                  key={`${item.sku}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: 10,
                    background: "#fff",
                  }}
                >
                  <ProductImage sku={item.sku} alt={item.name || item.sku} size={56} imageUrl={item.imageUrl} />
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.sku}</div>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {[item.brand, item.name].filter(Boolean).join(" · ") || "Catalog product"}
                    </div>
                    {item.note ? (
                      <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>{item.note}</div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <BtnSecondary onClick={() => moveItem(index, -1)} disabled={busy || index === 0}>
                      ↑
                    </BtnSecondary>
                    <BtnSecondary
                      onClick={() => moveItem(index, 1)}
                      disabled={busy || index === form.items.length - 1}
                    >
                      ↓
                    </BtnSecondary>
                    <BtnSecondary onClick={() => removeItem(item.sku)} disabled={busy}>
                      Remove
                    </BtnSecondary>
                  </div>
                </div>
              ))}
            </div>

            <BtnRow>
              <BtnPrimary onClick={() => void downloadPdf()} disabled={busy}>
                {busy ? "Working…" : "Generate PDF"}
              </BtnPrimary>
              <BtnSecondary onClick={() => void saveSheet()} disabled={busy}>
                Save sheet
              </BtnSecondary>
              <BtnSecondary onClick={() => void deleteSheet()} disabled={busy}>
                {form.id ? "Delete" : "Clear"}
              </BtnSecondary>
            </BtnRow>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
