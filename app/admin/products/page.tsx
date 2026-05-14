"use client";

import { useEffect, useMemo, useState } from "react";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
  source?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [status, setStatus] = useState("NORMAL");
  const [size, setSize] = useState("");
  const [barcode, setBarcode] = useState("");
  const [upc, setUpc] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load products.");

      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (error: any) {
      setMsg(error?.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return products.slice(0, 100);

    return products
      .filter((p) => {
        return (
          p.sku?.toUpperCase().includes(q) ||
          p.name?.toUpperCase().includes(q) ||
          p.brand?.toUpperCase().includes(q) ||
          p.barcode?.toUpperCase().includes(q) ||
          p.upc?.toUpperCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [products, search]);

  const selectProduct = (p: Product) => {
    setSku(p.sku || "");
    setName(p.name || "");
    setBrand(p.brand || "");
    setStatus((p.status || "NORMAL").toUpperCase());
    setSize(p.size || "");
    setBarcode(p.barcode || "");
    setUpc(p.upc || "");
    setMsg(`Editing ${p.sku}`);
  };

  const clearForm = () => {
    setSku("");
    setName("");
    setBrand("");
    setStatus("NORMAL");
    setSize("");
    setBarcode("");
    setUpc("");
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
        },
        body: JSON.stringify({
          sku: finalSku,
          name,
          brand,
          status,
          size,
          barcode,
          upc,
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

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Product SKU Manager</h1>
            <p style={subtitleStyle}>
              Edit SKU name, brand, status, size, barcode, and UPC online.
            </p>
          </div>

          <button type="button" onClick={loadProducts} style={secondaryButtonStyle}>
            Refresh
          </button>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{sku ? `Edit SKU: ${sku}` : "Add / Update SKU"}</h2>

          <div style={formGridStyle}>
            <Input label="SKU" value={sku} onChange={(v) => setSku(v.toUpperCase())} placeholder="00003D" />
            <Input label="Brand" value={brand} onChange={setBrand} placeholder="ASSI" />
            <Input label="Item Name" value={name} onChange={setName} placeholder="Product name" />
            <Input label="Status" value={status} onChange={(v) => setStatus(v.toUpperCase())} placeholder="NORMAL" />
            <Input label="Size" value={size} onChange={setSize} placeholder="CS 12X10 OZ" />
            <Input label="Barcode" value={barcode} onChange={setBarcode} placeholder="Barcode" />
            <Input label="UPC" value={upc} onChange={setUpc} placeholder="UPC" />
          </div>

          <div style={buttonRowStyle}>
            <button type="button" onClick={saveProduct} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Saving..." : "Save SKU"}
            </button>

            <button type="button" onClick={clearForm} style={secondaryButtonStyle}>
              Clear
            </button>
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 800,
                color: msg.toLowerCase().includes("failed") ? "#b91c1c" : "#15803d",
              }}
            >
              {msg}
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Products ({products.length})</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, name, brand, barcode..."
            style={{ ...inputStyle, marginTop: 12, marginBottom: 12 }}
          />

          <div style={listStyle}>
            {filteredProducts.map((p) => (
              <button
                key={p.sku}
                type="button"
                onClick={() => selectProduct(p)}
                style={productCardStyle}
              >
                <div>
                  <div style={productTitleStyle}>
                    {p.sku} · {p.brand || "-"}
                  </div>
                  <div style={productNameStyle}>{p.name || "-"}</div>
                  <div style={productMetaStyle}>
                    {p.size || "-"} · Source: {p.source || "Catalog"}
                  </div>
                </div>

                <span style={badgeStyle}>{p.status || "-"}</span>
              </button>
            ))}
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
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "18px 12px 30px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
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

const badgeStyle: React.CSSProperties = {
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  background: "#ecfdf5",
  color: "#059669",
  border: "1px solid #a7f3d0",
};