"use client";

import { useMemo, useState } from "react";

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
  source?: string;
};

const ADMIN_PASSWORD = "536678";

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

const categoryOptions = [
  "",
  "RICE",
  "NOODLES",
  "SAUCE",
  "SEASONING",
  "FROZEN",
  "REFRIGERATED",
  "SNACK",
  "PROCESSED",
  "NON-FOOD",
];

export default function AdminProductsPage() {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");

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

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleAdminLogin = async () => {
    setAdminError("");

    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      setAdminError("Invalid admin password.");
      return;
    }

    setAdminAuthed(true);
    await loadProducts(adminPassword.trim());
  };

  const loadProducts = async (password = adminPassword.trim()) => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/products", {
        cache: "no-store",
        headers: {
          "x-admin-password": password,
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load products.");

      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (error: any) {
      setMsg(error?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toUpperCase();

    if (!q) return products.slice(0, 150);

    return products
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
      .slice(0, 250);
  }, [products, search]);

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
    setMsg(`Editing ${p.sku}`);
  };

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
    setMsg("");
  };

  const saveProduct = async () => {
    const finalSku = sku.trim().toUpperCase();

    if (!finalSku) return alert("Please enter SKU.");
    if (!name.trim()) return alert("Please enter item name.");

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword.trim(),
        },
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
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to save product.");

      setMsg(`Saved ${finalSku}`);
      await loadProducts();
    } catch (error: any) {
      setMsg(error?.message || "Failed to save product.");
    } finally {
      setLoading(false);
    }
  };

  const uploadProductImage = async (file: File | null) => {
    const finalSku = sku.trim().toUpperCase();

    if (!finalSku) {
      alert("Please enter SKU before uploading image.");
      return;
    }

    if (!file) return;

    setUploadingImage(true);
    setMsg("");

    try {
      const formData = new FormData();
      formData.append("sku", finalSku);
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-product-image", {
        method: "POST",
        headers: {
          "x-admin-password": adminPassword.trim(),
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to upload image.");

      setImageUrl(data.imageUrl || "");
      setMsg(`Image uploaded for ${finalSku}`);
      await loadProducts();
    } catch (error: any) {
      setMsg(error?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (!adminAuthed) {
    return (
      <main style={loginPageStyle}>
        <section style={loginCardStyle}>
          <div style={logoStyle}>SKU</div>

          <h1 style={loginTitleStyle}>Product Admin Login</h1>
          <p style={loginSubtitleStyle}>
            Enter admin password to manage SKU settings.
          </p>

          <input
            type="password"
            value={adminPassword}
            onChange={(e) => {
              setAdminPassword(e.target.value);
              setAdminError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdminLogin();
            }}
            placeholder="Admin password"
            style={inputStyle}
          />

          {adminError ? <div style={errorStyle}>{adminError}</div> : null}

          <button type="button" onClick={handleAdminLogin} style={primaryButtonStyle}>
            Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Product SKU Manager</h1>
            <p style={subtitleStyle}>
              Edit SKU status, category, limited qty, pallet size, product image, and item info.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAdminAuthed(false);
              setAdminPassword("");
            }}
            style={secondaryButtonStyle}
          >
            Log Out
          </button>
        </section>

        <section style={statsGridStyle}>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{products.length}</div>
            <div style={statLabelStyle}>Total SKUs</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>
              {products.filter((p) => p.source === "Redis").length}
            </div>
            <div style={statLabelStyle}>Redis Updated</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>
              {products.filter((p) => p.category).length}
            </div>
            <div style={statLabelStyle}>Manual Category</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            {sku ? `Edit SKU: ${sku}` : "Add / Update SKU"}
          </h2>

          <div style={formGridStyle}>
            <Input label="SKU" value={sku} onChange={(v) => setSku(v.toUpperCase())} placeholder="00003D" />
            <Input label="Brand" value={brand} onChange={setBrand} placeholder="ASSI" />
            <Input label="Item Name" value={name} onChange={setName} placeholder="Product name" />

            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {categoryOptions.map((c) => (
                  <option key={c || "AUTO"} value={c}>
                    {c || "AUTO"}
                  </option>
                ))}
              </select>
            </div>

            <Input label="Size" value={size} onChange={setSize} placeholder="CS 12X10 OZ" />
            <Input label="Barcode" value={barcode} onChange={setBarcode} placeholder="Barcode" />
            <Input label="UPC" value={upc} onChange={setUpc} placeholder="UPC" />
            <Input label="Limited Qty" value={limitedQty} onChange={setLimitedQty} placeholder="Example: 10" />
            <Input label="Pallet Size" value={palletSize} onChange={setPalletSize} placeholder="Example: 56" />
            <Input label="Image URL" value={imageUrl} onChange={setImageUrl} placeholder="Auto-filled after upload" />

            <div>
              <label style={labelStyle}>Product Image</label>

              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={sku || "Product Image"}
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: "contain",
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    display: "block",
                    marginBottom: 8,
                  }}
                />
              ) : null}

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => uploadProductImage(e.target.files?.[0] || null)}
                style={inputStyle}
                disabled={uploadingImage}
              />

              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                {uploadingImage ? "Uploading..." : "PNG / JPG / WEBP"}
              </div>
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button type="button" onClick={saveProduct} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Saving..." : "Save SKU"}
            </button>

            <button type="button" onClick={clearForm} style={secondaryButtonStyle}>
              Clear
            </button>

            <button type="button" onClick={() => loadProducts()} style={secondaryButtonStyle}>
              Refresh
            </button>
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 800,
                color:
                  msg.toLowerCase().includes("failed") ||
                  msg.toLowerCase().includes("unauthorized")
                    ? "#b91c1c"
                    : "#15803d",
              }}
            >
              {msg}
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Products ({filteredProducts.length})</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, brand, category, barcode..."
            style={{ ...inputStyle, marginTop: 12, marginBottom: 12 }}
          />

          <div style={listStyle}>
            {filteredProducts.map((p) => (
              <button key={p.sku} type="button" onClick={() => selectProduct(p)} style={productCardStyle}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.sku}
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    />
                  ) : null}

                  <div>
                    <div style={productTitleStyle}>{p.sku} · {p.brand || "-"}</div>
                    <div style={productNameStyle}>{p.name || "-"}</div>
                    <div style={productMetaStyle}>
                      Category: {p.category || "AUTO"} · Pallet: {p.palletSize || "-"} · Limited: {p.limitedQty || "-"} · Source: {p.source || "Catalog"}
                    </div>
                  </div>
                </div>

                <span style={getBadgeStyle(p.status)}>{p.status || "-"}</span>
              </button>
            ))}

            {filteredProducts.length === 0 ? <div style={emptyStyle}>No products found.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function getBadgeStyle(status?: string): React.CSSProperties {
  const s = String(status || "").toUpperCase();

  const good = s === "NORMAL" || s === "NORMAL_NBR" || s === "NORMAL_NOBR" || s === "TBD";
  const limited = s === "LIMITED";

  return {
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
    background: good ? "#ecfdf5" : limited ? "#fff7ed" : "#fef2f2",
    color: good ? "#059669" : limited ? "#c2410c" : "#dc2626",
    border: good ? "1px solid #a7f3d0" : limited ? "1px solid #fed7aa" : "1px solid #fecaca",
  };
}

const loginPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const loginCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 40px rgba(37,99,235,0.12)",
};

const logoStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "#2563eb",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
  margin: "0 auto 14px",
};

const loginTitleStyle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: 26,
  fontWeight: 900,
  color: "#111827",
};

const loginSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 18px",
  textAlign: "center",
  fontSize: 13,
  color: "#6b7280",
};

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "18px 12px 30px",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#6b7280",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
};

const statNumberStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#2563eb",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 800,
  marginTop: 2,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#ffffff",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 10,
  fontSize: 13,
  fontWeight: 800,
  color: "#b91c1c",
  textAlign: "center",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 620,
  overflowY: "auto",
};

const productCardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: 14,
  padding: 13,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const productTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const productNameStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#374151",
  marginTop: 3,
};

const productMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 3,
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  color: "#6b7280",
  background: "#f9fafb",
  borderRadius: 12,
};