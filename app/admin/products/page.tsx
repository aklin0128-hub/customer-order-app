"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminPage } from "../_components/AdminPage";
import { AdminProductsVirtualList } from "../_components/AdminProductsVirtualList";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import { formGrid, inputStyle, labelStyle, splitForm, splitLayout, splitList } from "../_components/admin-styles";
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
import { AdminPublicShowcaseHint } from "../_components/AdminPublicShowcaseHint";
import { useAdminAuth } from "../_components/useAdminAuth";
import { isJustAddedItem, parseImportedAtMs } from "@/lib/catalogNewItems";
import { resolveNewItemStorageLabel } from "@/lib/newItemStorageLabel";
import {
  expandCategoryTags,
  readProductCategories,
} from "@/lib/productCategories";
import { CATEGORY_OPTIONS } from "@/lib/inferCategory";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
  limitedQty?: string;
  palletSize?: string;
  imageUrl?: string;
  category?: string;
  categories?: string[];
  isNew?: boolean;
  justAdded?: boolean;
  importedAt?: string;
  newItemDescription?: string;
  newItemDescriptionPdfUrl?: string;
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
  source?: string;
};

type StatusUploadResult = {
  sheetName?: string;
  totalRows?: number;
  updatedCount?: number;
  createdCount?: number;
  skippedCount?: number;
  updatedPreviewLabels?: string[];
  createdPreviewLabels?: string[];
  skippedPreview?: string[];
};

type ProductFilter = "all" | "redis" | "customized" | "new" | "justAdded" | "statusNew" | "discontinued" | "noImage";

const statusOptions = [
  "NORMAL",
  "NORMAL_NBR",
  "NORMAL_NOBR",
  "TBD",
  "NEW",
  "LIMITED",
  "SEASONAL",
  "DISCONTINUED",
  "INV",
];

const categoryOptions = CATEGORY_OPTIONS.filter((c) => c !== "ALL");
const AUTO_SAVE_DELAY_MS = 1200;
const MAX_NEW_ITEM_PDF_BYTES = 12 * 1024 * 1024;

async function readApiJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok ? "Empty server response." : `Request failed (${res.status || "unknown"}).`
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 413 || text.includes("Request Entity Too Large")) {
      throw new Error("PDF is too large. Maximum size is 12 MB.");
    }
    throw new Error(text.slice(0, 160) || `Request failed (${res.status}).`);
  }
}
/** Bump when admin new-item showcase UI changes — visible in Products editor to confirm deploy. */
const ADMIN_PRODUCTS_BUILD_TAG = "new-desc-v2";

function productImageSrc(sku: string, imageUrl?: string) {
  if (imageUrl) return imageUrl;
  if (sku) return `/product/${sku}.jpg`;
  return "";
}

function isNewProduct(p?: Product | null) {
  return Boolean(p?.isNew);
}

function formatImportedAtLabel(value?: string) {
  const ms = parseImportedAtMs(value);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString();
}

export default function AdminProductsPage() {
  const { authed, adminHeaders } = useAdminAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ProductFilter>("all");
  const [selectedProductSkus, setSelectedProductSkus] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkNewFlag, setBulkNewFlag] = useState<"keep" | "yes" | "no">("keep");
  const [bulkJustAddedFlag, setBulkJustAddedFlag] = useState<"keep" | "yes" | "no">("keep");
  const [initialSkuFromQuery, setInitialSkuFromQuery] = useState("");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("NORMAL");
  const [categories, setCategories] = useState<string[]>([]);
  const [size, setSize] = useState("");
  const [barcode, setBarcode] = useState("");
  const [upc, setUpc] = useState("");
  const [limitedQty, setLimitedQty] = useState("");
  const [palletSize, setPalletSize] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemDescriptionPdfUrl, setNewItemDescriptionPdfUrl] = useState("");

  const showcaseStorageLabel = useMemo(
    () => resolveNewItemStorageLabel({ categories, category: categories[0] }),
    [categories]
  );

  const [busy, setBusy] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingNewPdf, setUploadingNewPdf] = useState(false);
  const [uploadingStatusXlsx, setUploadingStatusXlsx] = useState(false);
  const [statusUploadResult, setStatusUploadResult] = useState<StatusUploadResult | null>(null);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");
  const [formDirty, setFormDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const markDirty = () => {
    setFormDirty(true);
    setAutoSaveStatus("Saving...");
  };

  const toggleProductCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((value) => value !== cat) : expandCategoryTags([...prev, cat])
    );
    markDirty();
  };

  const updateText = (setter: (value: string) => void, value: string) => {
    setter(value);
    markDirty();
  };

  const loadProducts = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(String(data?.error || "Failed to load products."));
      setProducts(Array.isArray(data.products) ? (data.products as Product[]) : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load products.", "error");
    } finally {
      setBusy(false);
      setProductsLoaded(true);
    }
  };

  useEffect(() => {
    if (authed) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("sku");
    if (fromUrl) {
      const clean = fromUrl.trim().toUpperCase();
      setInitialSkuFromQuery(clean);
      setSearch(clean);
    }
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toUpperCase();

    let list = products;

    if (listFilter === "redis") {
      list = list.filter((p) => p.source === "Redis");
    } else if (listFilter === "customized") {
      list = list.filter(
        (p) =>
          p.source === "Redis" ||
          p.category ||
          readProductCategories(p).join(" ") ||
          p.imageUrl ||
          p.limitedQty ||
          p.palletSize ||
          typeof p.isNew === "boolean" ||
          typeof p.justAdded === "boolean"
      );
    } else if (listFilter === "new") {
      list = list.filter((p) => isNewProduct(p));
    } else if (listFilter === "justAdded") {
      list = list.filter((p) => isJustAddedItem(p));
    } else if (listFilter === "statusNew") {
      list = list.filter((p) => String(p.status || "").trim().toUpperCase() === "NEW");
    } else if (listFilter === "discontinued") {
      list = list.filter((p) => String(p.status || "").trim().toUpperCase() === "DISCONTINUED");
    } else if (listFilter === "noImage") {
      list = list.filter((p) => !p.imageUrl);
    }

    if (!q) return list.slice(0, 120);

    return list
      .filter((p) => {
        return (
          p.sku?.toUpperCase().includes(q) ||
          p.name?.toUpperCase().includes(q) ||
          p.brand?.toUpperCase().includes(q) ||
          p.category?.toUpperCase().includes(q) ||
          p.barcode?.toUpperCase().includes(q) ||
          p.upc?.toUpperCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [products, search, listFilter]);

  const selectProduct = (p: Product) => {
    setSku(p.sku || "");
    setName(p.name || "");
    setBrand(p.brand || "");
    setStatus((p.status || "NORMAL").toUpperCase());
    setCategories(expandCategoryTags(readProductCategories(p)));
    setSize(p.size || "");
    setBarcode(p.barcode || "");
    setUpc(p.upc || "");
    setLimitedQty(p.limitedQty || "");
    setPalletSize(p.palletSize || "");
    setImageUrl(p.imageUrl || "");
    setIsNew(typeof p.isNew === "boolean" ? p.isNew : false);
    setJustAdded(Boolean(p.justAdded));
    setNewItemDescription(p.newItemDescription || "");
    setNewItemDescriptionPdfUrl(p.newItemDescriptionPdfUrl || "");
    setFormDirty(false);
    setAutoSaveStatus("");
    notify(`Editing ${p.sku}`);
  };

  const selectedProducts = products.filter((p) =>
    selectedProductSkus.includes(p.sku?.toUpperCase())
  );
  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductSkus.includes(p.sku?.toUpperCase()));

  const toggleProductSelection = (targetSku: string) => {
    const clean = targetSku.toUpperCase();
    setSelectedProductSkus((prev) =>
      prev.includes(clean) ? prev.filter((item) => item !== clean) : [...prev, clean]
    );
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const applyBulkProductUpdate = async () => {
    if (selectedProducts.length === 0) return notify("Select SKUs first.", "error");
    if (!bulkStatus && !bulkCategory && bulkNewFlag === "keep" && bulkJustAddedFlag === "keep") {
      return notify("Choose a bulk change first.", "error");
    }
    if (!confirm(`Apply bulk update to ${selectedProducts.length} SKU(s)?`)) return;

    setBusy(true);
    try {
      let updated = 0;

      for (const product of selectedProducts) {
        const nextProduct = {
          ...product,
          status: bulkStatus || product.status || "NORMAL",
          categories: bulkCategory ? expandCategoryTags([bulkCategory]) : expandCategoryTags(readProductCategories(product)),
          isNew: bulkNewFlag === "keep" ? Boolean(product.isNew) : bulkNewFlag === "yes",
          justAdded:
            bulkJustAddedFlag === "keep" ? Boolean(product.justAdded) : bulkJustAddedFlag === "yes",
        };

        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: adminHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(nextProduct),
        });
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(String(data?.error || `Failed to save ${product.sku}.`));

        const saved = data.product as Product | undefined;
        if (saved?.sku) {
          updated += 1;
          setProducts((prev) => prev.map((item) =>
            item.sku?.toUpperCase() === saved.sku.toUpperCase()
              ? { ...item, ...saved }
              : item
          ));
        }
      }

      setSelectedProductSkus([]);
      notify(`Bulk updated ${updated} SKU(s).`);
    } catch (err: any) {
      notify(err?.message || "Bulk update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!initialSkuFromQuery || products.length === 0) return;
    const match = products.find((p) => p.sku?.toUpperCase() === initialSkuFromQuery);
    if (!match) return;
    selectProduct(match);
    setInitialSkuFromQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSkuFromQuery, products]);

  const clearForm = () => {
    setSku("");
    setName("");
    setBrand("");
    setStatus("NORMAL");
    setCategories([]);
    setSize("");
    setBarcode("");
    setUpc("");
    setLimitedQty("");
    setPalletSize("");
    setImageUrl("");
    setIsNew(false);
    setJustAdded(false);
    setNewItemDescription("");
    setNewItemDescriptionPdfUrl("");
    setFormDirty(false);
    setAutoSaveStatus("");
    setMsg("");
  };

  const saveProduct = async (options: { auto?: boolean } = {}) => {
    const auto = Boolean(options.auto);
    const finalSku = sku.trim().toUpperCase();
    if (!finalSku) {
      if (!auto) notify("Please enter SKU.", "error");
      return false;
    }
    if (!name.trim()) {
      if (!auto) notify("Please enter item name.", "error");
      return false;
    }

    if (auto) setAutoSaveStatus("Saving...");
    else setBusy(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sku: finalSku,
          name,
          brand,
          status,
          categories,
          size,
          barcode,
          upc,
          limitedQty,
          palletSize,
          imageUrl,
          isNew,
          justAdded,
          newItemDescription,
          newItemDescriptionPdfUrl,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(String(data?.error || "Failed to save product."));

      const saved = data.product as Product | undefined;
      if (saved?.sku) {
        setProducts((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.sku?.toUpperCase() === saved.sku.toUpperCase());
          if (idx >= 0) next[idx] = { ...next[idx], ...saved };
          else next.unshift(saved);
          return next;
        });
      }

      setFormDirty(false);
      setAutoSaveStatus(auto ? `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "");
      if (!auto) notify(`Saved ${finalSku}`);
      return true;
    } catch (err: any) {
      if (auto) setAutoSaveStatus(`Save failed: ${err?.message || "Failed to save product."}`);
      else notify(err?.message || "Failed to save product.", "error");
      return false;
    } finally {
      if (!auto) setBusy(false);
    }
  };

  useEffect(() => {
    if (!authed || !formDirty || uploadingNewPdf) return;

    const finalSku = sku.trim().toUpperCase();
    if (!finalSku || !name.trim()) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void saveProduct({ auto: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, formDirty, uploadingNewPdf, sku, name, brand, status, categories, size, barcode, upc, limitedQty, palletSize, imageUrl, isNew, justAdded, newItemDescription, newItemDescriptionPdfUrl]);

  const uploadNewItemPdf = async (file: File | null) => {
    const finalSku = sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter SKU first, then upload a PDF.", "error");
    if (!file) return;

    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    if (type !== "application/pdf" && !name.endsWith(".pdf")) {
      return notify("Only PDF files are allowed.", "error");
    }
    if (file.size > MAX_NEW_ITEM_PDF_BYTES) {
      return notify("PDF must be 12 MB or smaller.", "error");
    }

    setUploadingNewPdf(true);
    try {
      const blob = await upload(`new-item-pdfs/${finalSku}.pdf`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/upload-new-item-pdf",
        clientPayload: JSON.stringify({ sku: finalSku }),
        headers: adminHeaders(),
        contentType: "application/pdf",
        multipart: file.size > 5 * 1024 * 1024,
      });

      const res = await fetch("/api/admin/register-new-item-pdf", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ sku: finalSku, pathname: blob.pathname }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(String(data?.error || "Failed to register PDF."));

      const pdfUrl = String(data.newItemDescriptionPdfUrl || "");
      setNewItemDescriptionPdfUrl(pdfUrl);
      setProducts((prev) =>
        prev.map((p) =>
          p.sku?.toUpperCase() === finalSku
            ? { ...p, newItemDescriptionPdfUrl: pdfUrl, source: "Redis" as const }
            : p
        )
      );
      setFormDirty(false);
      setAutoSaveStatus("");
      notify(`PDF uploaded for ${finalSku}`);
    } catch (err: any) {
      notify(err?.message || "Failed to upload PDF.", "error");
    } finally {
      setUploadingNewPdf(false);
    }
  };

  const uploadProductImage = async (file: File | null) => {
    const finalSku = sku.trim().toUpperCase();
    if (!finalSku) return notify("Enter SKU first, then upload an image.", "error");
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("sku", finalSku);
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-product-image", {
        method: "POST",
        headers: adminHeaders(),
        body: formData,
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(String(data?.error || "Failed to upload image."));
      setImageUrl(String(data.imageUrl || ""));
      markDirty();
      notify(`Image uploaded for ${finalSku}`);
      await loadProducts();
    } catch (err: any) {
      notify(err?.message || "Failed to upload image.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadStatusXlsx = async (file: File | null) => {
    if (!file) return;

    setUploadingStatusXlsx(true);
    setStatusUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-status-xlsx", {
        method: "POST",
        headers: adminHeaders(),
        body: formData,
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(String(data?.error || "Failed to upload status XLSX."));

      setStatusUploadResult(data as StatusUploadResult);
      notify(
        `Status upload complete: ${Number(data.updatedCount) || 0} updated, ${Number(data.createdCount) || 0} created, ${Number(data.skippedCount) || 0} skipped.`
      );
      await loadProducts();
    } catch (err: any) {
      notify(err?.message || "Failed to upload status XLSX.", "error");
    } finally {
      setUploadingStatusXlsx(false);
    }
  };

  const previewSrc = productImageSrc(sku.trim().toUpperCase(), imageUrl);

  return (
    <AdminPage
      active="products"
      title="Products"
      subtitle="Search a SKU, edit details · New flag syncs to /new/ and customer catalog."
      loginSubtitle="Sign in to manage SKU settings and photos."
      actions={
        <BtnSecondary onClick={() => { clearForm(); notify("Enter a SKU to add or edit."); }}>
          + Find / edit SKU
        </BtnSecondary>
      }
    >
      <StatGrid
        items={[
          { label: "Catalog SKUs", value: products.length },
          { label: "Redis overrides", value: products.filter((p) => p.source === "Redis").length },
          { label: "With category", value: products.filter((p) => readProductCategories(p).length > 0).length },
          { label: "New items", value: products.filter((p) => isNewProduct(p)).length },
          { label: "JUST ADDED pin", value: products.filter((p) => isJustAddedItem(p)).length },
        ]}
      />

      <AdminPublicShowcaseHint variant="products" />

      {!productsLoaded && busy ? (
        <Panel title="Loading products">
          <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading product list...</p>
        </Panel>
      ) : null}

      <Panel title="Bulk tools">
        <details>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#2563eb" }}>
            Upload today_update.xlsx (status, UPC, pallet size)
          </summary>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => uploadStatusXlsx(e.target.files?.[0] || null)}
              style={inputStyle}
              disabled={uploadingStatusXlsx}
            />
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Reads <strong>PID/SKU</strong>, <strong>Status</strong>, <strong>UPC</strong>, <strong>PL</strong>, and other Export columns.
              Unknown SKUs are created in Redis. Status <strong>NEW</strong> is not customer “New items”.
            </p>
            {uploadingStatusXlsx ? <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "#2563eb" }}>Uploading and updating status...</p> : null}
            {statusUploadResult ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb", fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>
                  Sheet {statusUploadResult.sheetName || "-"}: {statusUploadResult.updatedCount || 0} updated, {statusUploadResult.createdCount || 0} created / {statusUploadResult.totalRows || 0} rows
                </div>
                {statusUploadResult.updatedPreviewLabels?.length ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Updated:</strong> {statusUploadResult.updatedPreviewLabels.join(", ")}
                    {(statusUploadResult.updatedCount || 0) > statusUploadResult.updatedPreviewLabels.length ? " ..." : ""}
                  </div>
                ) : null}
                {statusUploadResult.createdPreviewLabels?.length ? (
                  <div style={{ marginTop: 6, color: "#047857" }}>
                    <strong>Created:</strong> {statusUploadResult.createdPreviewLabels.join(", ")}
                    {(statusUploadResult.createdCount || 0) > statusUploadResult.createdPreviewLabels.length ? " ..." : ""}
                  </div>
                ) : null}
                {statusUploadResult.skippedPreview?.length ? (
                  <div style={{ marginTop: 6, color: "#6b7280" }}>
                    <strong>Skipped rows:</strong> {statusUploadResult.skippedPreview.join(", ")}
                    {(statusUploadResult.skippedCount || 0) > statusUploadResult.skippedPreview.length ? " ..." : ""}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </details>
      </Panel>

      <div style={splitLayout} className="admin-split">
        <Panel title={`SKU list (${filteredProducts.length}${search ? "" : ", search for more"})`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type SKU, name, brand, or barcode..."
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <FilterChips
            value={listFilter}
            onChange={setListFilter}
            options={[
              { id: "all", label: "Browse" },
              { id: "new", label: "New items" },
              { id: "justAdded", label: "JUST ADDED" },
              { id: "statusNew", label: "Status NEW" },
              { id: "discontinued", label: "Discontinued" },
              { id: "noImage", label: "No uploaded image" },
              { id: "redis", label: "Redis only" },
              { id: "customized", label: "Customized" },
            ]}
          />
          {!search.trim() && listFilter === "all" ? (
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
              Tip: search by SKU to find items quickly. Showing first 120 without a search.
            </p>
          ) : null}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb", marginBottom: 10, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setSelectedProductSkus(allFilteredSelected ? [] : filteredProducts.map((p) => p.sku.toUpperCase()))}
                disabled={busy}
                style={{ border: "1px solid #d1d5db", background: "#fff", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 900, cursor: busy ? "not-allowed" : "pointer" }}
              >
                {allFilteredSelected ? "Clear selection" : "Select shown"}
              </button>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
                {selectedProducts.length} selected
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
              <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={inputStyle}>
                <option value="">Keep status</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} style={inputStyle}>
                <option value="">Keep category</option>
                {categoryOptions.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={bulkNewFlag} onChange={(e) => setBulkNewFlag(e.target.value as "keep" | "yes" | "no")} style={inputStyle}>
                <option value="keep">Keep New flag</option>
                <option value="yes">Set New items: Yes</option>
                <option value="no">Set New items: No</option>
              </select>
              <select
                value={bulkJustAddedFlag}
                onChange={(e) => setBulkJustAddedFlag(e.target.value as "keep" | "yes" | "no")}
                style={inputStyle}
              >
                <option value="keep">Keep JUST ADDED</option>
                <option value="yes">JUST ADDED: On</option>
                <option value="no">JUST ADDED: Off</option>
              </select>
              <button
                type="button"
                onClick={() => void applyBulkProductUpdate()}
                disabled={busy || selectedProducts.length === 0}
                style={{ border: "none", background: busy || selectedProducts.length === 0 ? "#93c5fd" : "#2563eb", color: "#fff", borderRadius: 10, padding: "9px 12px", fontSize: 12, fontWeight: 900, cursor: busy || selectedProducts.length === 0 ? "not-allowed" : "pointer" }}
              >
                Apply bulk
              </button>
            </div>
          </div>
          {filteredProducts.length === 0 ? (
            <EmptyState title="No SKUs found" detail="Try another search term or filter." />
          ) : (
            <AdminProductsVirtualList
              items={filteredProducts}
              selectedSku={sku}
              selectedSkus={selectedProductSkus}
              onToggleSelect={toggleProductSelection}
              onSelectProduct={selectProduct}
            />
          )}
        </Panel>

        <div style={splitForm} className="admin-catalog-form-sticky">
          <Panel title={sku ? `Edit ${sku}` : "SKU details"}>
            <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 8, fontWeight: 700 }}>
              Build {ADMIN_PRODUCTS_BUILD_TAG}
              {!sku.trim() ? " · 选择左侧 SKU 后可编辑新品介绍" : null}
            </div>
            {autoSaveStatus ? (
              <div
                style={{
                  marginBottom: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  color: autoSaveStatus.includes("failed") ? "#b91c1c" : formDirty ? "#b45309" : "#059669",
                }}
              >
                {autoSaveStatus}
              </div>
            ) : null}

            {previewSrc ? (
              <img
                src={previewSrc}
                alt=""
                style={{
                  width: 96,
                  height: 96,
                  objectFit: "contain",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  marginBottom: 12,
                  background: "#fff",
                }}
              />
            ) : null}

            <div style={formGrid}>
              <div>
                <label style={labelStyle}>SKU</label>
                <AdminSkuAutocomplete
                  value={sku}
                  onChange={(v) => updateText(setSku, v)}
                  placeholder="Type SKU or name…"
                />
              </div>
              <div>
                <label style={labelStyle}>Brand</label>
                <input value={brand} onChange={(e) => updateText(setBrand, e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Item name</label>
                <input value={name} onChange={(e) => updateText(setName, e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={status} onChange={(e) => updateText(setStatus, e.target.value)} style={inputStyle}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Category</label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 6,
                    paddingBottom: 4,
                  }}
                >
                  {categoryOptions.map((cat) => {
                    const active = categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleProductCategory(cat)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
                          background: active ? "#eff6ff" : "#ffffff",
                          color: active ? "#2563eb" : "#374151",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                  {categories.length > 0
                    ? `Selected: ${categories.join(", ")}. Categories: DRY, FROZEN, FRESH, HOUSEWARE. Saved overrides apply on the order page.`
                    : "No selection = AUTO (use catalog-inferred category). Tap to select one or more."}
                </div>
              </div>
              <label
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #fed7aa",
                  borderRadius: 12,
                  padding: 12,
                  background: isNew ? "#fff7ed" : "#fff",
                  color: "#9a3412",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={isNew}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setIsNew(next);
                    markDirty();
                    if (next) {
                      requestAnimationFrame(() => {
                        document.getElementById("admin-new-item-showcase")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      });
                    }
                  }}
                />
                Show in customer “New items” (you set this — not read from name or Excel)
                <span style={{ fontWeight: 600, color: "#c2410c" }}>
                  {" "}
                  (
                  <a href="/new/" target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8" }}>
                    /new/
                  </a>
                  )
                </span>
              </label>
              <label
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "1px solid #fca5a5",
                  borderRadius: 12,
                  padding: 12,
                  background: justAdded ? "#fef2f2" : "#fff",
                  color: "#991b1b",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={justAdded}
                  onChange={(e) => {
                    setJustAdded(e.target.checked);
                    markDirty();
                  }}
                />
                JUST ADDED — pin to top on customer order (red badge)
              </label>
              <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#6b7280", marginTop: -4 }}>
                Catalog import time (reference only):{" "}
                {formatImportedAtLabel(products.find((p) => p.sku?.toUpperCase() === sku.toUpperCase())?.importedAt)}
              </div>
              <div>
                <label style={labelStyle}>Size</label>
                <input value={size} onChange={(e) => updateText(setSize, e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Limited qty</label>
                <input value={limitedQty} onChange={(e) => updateText(setLimitedQty, e.target.value)} style={inputStyle} placeholder="e.g. 10" />
              </div>
              <div>
                <label style={labelStyle}>Pallet size</label>
                <input value={palletSize} onChange={(e) => updateText(setPalletSize, e.target.value)} style={inputStyle} placeholder="e.g. 56" />
              </div>
              <div>
                <label style={labelStyle}>Barcode</label>
                <input value={barcode} onChange={(e) => updateText(setBarcode, e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>UPC</label>
                <input value={upc} onChange={(e) => updateText(setUpc, e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Image URL</label>
                <input value={imageUrl} onChange={(e) => updateText(setImageUrl, e.target.value)} style={inputStyle} placeholder="Filled after upload" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Upload photo</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => uploadProductImage(e.target.files?.[0] || null)}
                  style={inputStyle}
                  disabled={uploadingImage}
                />
                <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0" }}>
                  {uploadingImage ? "Uploading..." : "PNG, JPG, or WEBP"}
                </p>
              </div>
            </div>

            {sku.trim() ? (
              <div
                id="admin-new-item-showcase"
                className="admin-new-showcase-panel"
                style={{
                  marginTop: 16,
                  marginBottom: 16,
                  border: isNew ? "2px solid #2563eb" : "2px dashed #94a3b8",
                  borderRadius: 14,
                  padding: 16,
                  background: isNew ? "#eff6ff" : "#f8fafc",
                  scrollMarginTop: 88,
                }}
              >
                <div style={{ fontSize: 17, fontWeight: 950, color: isNew ? "#1e40af" : "#334155", marginBottom: 6 }}>
                  新品介绍 · /new/ 页面
                </div>
                <div style={{ fontSize: 13, color: isNew ? "#1d4ed8" : "#64748b", marginBottom: 14, lineHeight: 1.55 }}>
                  {isNew
                    ? "顾客在 /new/ 新品页可点「查看说明」弹出介绍。可填文字、上传 PDF。DRY / FROZEN / FRESH 标签来自上方 Category。"
                    : "请先在上方勾选「Show in customer New items」，再填写下方内容。"}
                </div>
                <fieldset disabled={!isNew} style={{ border: "none", margin: 0, padding: 0, opacity: isNew ? 1 : 0.5 }}>
                  <label style={labelStyle}>仓储标签 (from Category)</label>
                  <div
                    style={{
                      ...inputStyle,
                      display: "flex",
                      alignItems: "center",
                      minHeight: 40,
                      fontWeight: 800,
                      color: showcaseStorageLabel ? "#111827" : "#9ca3af",
                      background: "#f9fafb",
                    }}
                  >
                    {showcaseStorageLabel ||
                      (categories.length > 0
                        ? "—"
                        : "Select Category above (DRY / FROZEN / FRESH / HOUSEWARE → DRY)")}
                  </div>
                  <label style={{ ...labelStyle, marginTop: 12 }}>文字介绍</label>
                  <textarea
                    value={newItemDescription}
                    onChange={(e) => updateText(setNewItemDescription, e.target.value)}
                    style={{ ...inputStyle, minHeight: 100, resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    placeholder="例如：卖点、规格、到货说明…"
                  />
                  <label style={{ ...labelStyle, marginTop: 12 }}>上传产品介绍 PDF</label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => uploadNewItemPdf(e.target.files?.[0] || null)}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                    disabled={uploadingNewPdf || !isNew}
                  />
                  <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0" }}>
                    {uploadingNewPdf ? "正在上传…" : "仅 PDF，最大 12 MB。大文件直传存储，选择后立即保存。"}
                  </p>
                  {newItemDescriptionPdfUrl ? (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <a
                        href={newItemDescriptionPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}
                      >
                        预览 PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setNewItemDescriptionPdfUrl("");
                          markDirty();
                        }}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fff",
                          borderRadius: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          fontWeight: 800,
                          color: "#b91c1c",
                          cursor: "pointer",
                        }}
                      >
                        删除 PDF
                      </button>
                    </div>
                  ) : null}
                </fieldset>
              </div>
            ) : null}

            <BtnRow>
              <BtnPrimary onClick={() => void saveProduct()} disabled={busy || !formDirty}>
                {busy ? "Saving..." : formDirty ? "Save now" : "Saved automatically"}
              </BtnPrimary>
              <BtnSecondary onClick={clearForm}>Clear</BtnSecondary>
              <BtnSecondary onClick={loadProducts} disabled={busy}>
                Refresh
              </BtnSecondary>
            </BtnRow>

            <Toast message={msg} tone={msgTone} />
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || "").toUpperCase();
  const good = s === "NORMAL" || s === "NORMAL_NBR" || s === "NORMAL_NOBR" || s === "TBD";
  const limited = s === "LIMITED";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 900,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: good ? "#ecfdf5" : limited ? "#fff7ed" : "#fef2f2",
        color: good ? "#059669" : limited ? "#c2410c" : "#dc2626",
      }}
    >
      {s || "—"}
    </span>
  );
}

function NewBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 950,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
      }}
    >
      NEW
    </span>
  );
}

function JustAddedBadge() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 950,
        padding: "3px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: "#dc2626",
        color: "#ffffff",
        border: "1px solid #b91c1c",
        letterSpacing: "0.05em",
      }}
    >
      JUST ADDED
    </span>
  );
}
