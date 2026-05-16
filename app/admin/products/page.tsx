"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { formGrid, inputStyle, labelStyle, splitForm, splitLayout, splitList } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  FilterChips,
  ListItemButton,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";
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
  isNew?: boolean;
  source?: string;
};

type ProductFilter = "all" | "redis" | "customized" | "new";

const statusOptions = [
  "NORMAL",
  "NORMAL_NBR",
  "NORMAL_NOBR",
  "TBD",
  "LIMITED",
  "SEASONAL",
  "DISCONTINUED",
  "INV",
];

const categoryOptions = ["", ...CATEGORY_OPTIONS.filter((c) => c !== "ALL")];

function productImageSrc(sku: string, imageUrl?: string) {
  if (imageUrl) return imageUrl;
  if (sku) return `/product/${sku}.jpg`;
  return "";
}

function isNewProduct(p?: Product | null) {
  if (typeof p?.isNew === "boolean") return p.isNew;

  const text = [p?.name, p?.size, p?.status]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[_-]+/g, " ");
  return /(^|\s)NEW(\s|$)/.test(text);
}

export default function AdminProductsPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<ProductFilter>("all");
  const [initialSkuFromQuery, setInitialSkuFromQuery] = useState("");

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("NORMAL");
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [barcode, setBarcode] = useState("");
  const [upc, setUpc] = useState("");
  const [limitedQty, setLimitedQty] = useState("");
  const [palletSize, setPalletSize] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isNew, setIsNew] = useState(false);

  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
    setAutoSaveStatus("Unsaved changes");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load products.");
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load products.", "error");
    } finally {
      setBusy(false);
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
      list = list.filter((p) => p.source === "Redis" || p.category || p.imageUrl || p.limitedQty || p.palletSize || typeof p.isNew === "boolean");
    } else if (listFilter === "new") {
      list = list.filter((p) => isNewProduct(p));
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
    setCategory((p.category || "").toUpperCase());
    setSize(p.size || "");
    setBarcode(p.barcode || "");
    setUpc(p.upc || "");
    setLimitedQty(p.limitedQty || "");
    setPalletSize(p.palletSize || "");
    setImageUrl(p.imageUrl || "");
    setIsNew(isNewProduct(p));
    setFormDirty(false);
    setAutoSaveStatus("");
    notify(`Editing ${p.sku}`);
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
    setCategory("");
    setSize("");
    setBarcode("");
    setUpc("");
    setLimitedQty("");
    setPalletSize("");
    setImageUrl("");
    setIsNew(false);
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

    if (auto) setAutoSaveStatus("Auto-saving...");
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
          category,
          size,
          barcode,
          upc,
          limitedQty,
          palletSize,
          imageUrl,
          isNew,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save product.");

      if (data.product?.sku) {
        setProducts((prev) => {
          const next = [...prev];
          const idx = next.findIndex((p) => p.sku?.toUpperCase() === data.product.sku.toUpperCase());
          if (idx >= 0) next[idx] = { ...next[idx], ...data.product };
          else next.unshift(data.product);
          return next;
        });
      }

      setFormDirty(false);
      setAutoSaveStatus(auto ? `Saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "");
      if (!auto) notify(`Saved ${finalSku}`);
      return true;
    } catch (err: any) {
      if (auto) setAutoSaveStatus(`Auto-save failed: ${err?.message || "Failed to save product."}`);
      else notify(err?.message || "Failed to save product.", "error");
      return false;
    } finally {
      if (!auto) setBusy(false);
    }
  };

  useEffect(() => {
    if (!authed || !formDirty) return;

    const finalSku = sku.trim().toUpperCase();
    if (!finalSku || !name.trim()) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void saveProduct({ auto: true });
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, formDirty, sku, name, brand, status, category, size, barcode, upc, limitedQty, palletSize, imageUrl, isNew]);

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
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to upload image.");
      setImageUrl(data.imageUrl || "");
      markDirty();
      notify(`Image uploaded for ${finalSku}`);
      await loadProducts();
    } catch (err: any) {
      notify(err?.message || "Failed to upload image.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Products"
        subtitle="Sign in to manage SKU settings and photos."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  const previewSrc = productImageSrc(sku.trim().toUpperCase(), imageUrl);

  return (
    <AdminShell
      active="products"
      title="Products"
      subtitle="Search a SKU, edit details, and save overrides to Redis."
      onLogout={logout}
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
          { label: "With category", value: products.filter((p) => p.category).length },
          { label: "New items", value: products.filter((p) => isNewProduct(p)).length },
        ]}
      />

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
              { id: "redis", label: "Redis only" },
              { id: "customized", label: "Customized" },
            ]}
          />
          {!search.trim() && listFilter === "all" ? (
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
              Tip: search by SKU to find items quickly. Showing first 120 without a search.
            </p>
          ) : null}
          <div style={splitList}>
            {filteredProducts.map((p) => (
              <ListItemButton
                key={p.sku}
                selected={sku.toUpperCase() === p.sku?.toUpperCase()}
                onClick={() => selectProduct(p)}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {productImageSrc(p.sku, p.imageUrl) ? (
                    <img
                      src={productImageSrc(p.sku, p.imageUrl)}
                      alt=""
                      style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: "#f3f4f6",
                        fontSize: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9ca3af",
                      }}
                    >
                      No img
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{p.sku}</strong>
                    <div style={{ fontSize: 12, color: "#374151" }}>{p.name || "—"}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {p.brand || "—"} · {p.source || "Catalog"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {isNewProduct(p) ? <NewBadge /> : null}
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              </ListItemButton>
            ))}
            {filteredProducts.length === 0 ? (
              <EmptyState title="No SKUs found" detail="Try another search term or filter." />
            ) : null}
          </div>
        </Panel>

        <div style={splitForm}>
          <Panel title={sku ? `Edit ${sku}` : "SKU details"}>
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
                <input
                  value={sku}
                  onChange={(e) => updateText(setSku, e.target.value.toUpperCase())}
                  placeholder="00003D"
                  style={inputStyle}
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
              <div>
                <label style={labelStyle}>Category</label>
                <select value={category} onChange={(e) => updateText(setCategory, e.target.value)} style={inputStyle}>
                  {categoryOptions.map((c) => (
                    <option key={c || "AUTO"} value={c}>
                      {c || "AUTO (from catalog)"}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                  Saved in Redis overrides the spreadsheet category for this SKU on the customer order page.
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
                <input type="checkbox" checked={isNew} onChange={(e) => { setIsNew(e.target.checked); markDirty(); }} />
                Show this SKU in customer “New items”
              </label>
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
    </AdminShell>
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
