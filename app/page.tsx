"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import catalogData from "@/data/catalog_sku_master_extracted.json";

type CatalogItem = {
  sku: string;
  name?: string;
  pack?: string;
  brand?: string;
  status?: string;
  barcode?: string;
  upc?: string;
};

type CartItem = {
  sku: string;
  name?: string;
  pack?: string;
  brand?: string;
  status?: string;
  qty: number;
};

const catalog = catalogData as CatalogItem[];

function getStatusBadgeStyle(status?: string): React.CSSProperties {
  const value = (status || "").toUpperCase();

  if (value === "NEW") {
    return {
      background: "#ecfdf5",
      color: "#059669",
      border: "1px solid #a7f3d0",
    };
  }

  if (value === "SALE") {
    return {
      background: "#fff7ed",
      color: "#ea580c",
      border: "1px solid #fdba74",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#6b7280",
    border: "1px solid #d1d5db",
  };
}

export default function Home() {
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [notes, setNotes] = useState("");

  const [skuInput, setSkuInput] = useState("");
  const [qtyInput, setQtyInput] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const skuInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedInput = skuInput.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalizedInput || normalizedInput.length < 3) return [];

    return catalog
      .filter((item) => {
        const sku = item.sku?.toLowerCase() || "";
        const barcode = item.barcode?.toLowerCase() || "";
        const upc = item.upc?.toLowerCase() || "";
        const name = item.name?.toLowerCase() || "";
        const brand = item.brand?.toLowerCase() || "";

        return (
          sku.includes(normalizedInput) ||
          barcode.includes(normalizedInput) ||
          upc.includes(normalizedInput) ||
          name.includes(normalizedInput) ||
          brand.includes(normalizedInput)
        );
      })
      .slice(0, 10);
  }, [normalizedInput]);

  const exactSkuMatch = useMemo(() => {
    if (!normalizedInput) return null;
    return (
      catalog.find((item) => (item.sku || "").toLowerCase() === normalizedInput) ||
      null
    );
  }, [normalizedInput]);

  useEffect(() => {
    if (!normalizedInput || normalizedInput.length < 3) {
      setSelectedItem(null);
      return;
    }

    if (suggestions.length === 0) {
      setSelectedItem(null);
      return;
    }

    const stillExists = selectedItem
      ? suggestions.some((item) => item.sku === selectedItem.sku)
      : false;

    if (!stillExists) {
      setSelectedItem(suggestions[0]);
    }
  }, [normalizedInput, suggestions, selectedItem]);

  const focusSkuInput = () => {
    setTimeout(() => {
      skuInputRef.current?.focus();
      skuInputRef.current?.select();
    }, 0);
  };

  const addToCart = (item?: CatalogItem) => {
    const finalItem = item || selectedItem || exactSkuMatch;

    if (!finalItem) {
      alert("Please select an item first.");
      focusSkuInput();
      return;
    }

    const qty = Math.max(1, Number(qtyInput) || 1);

    setCart((prev) => {
      const existing = prev.find((x) => x.sku === finalItem.sku);

      if (existing) {
        return prev.map((x) =>
          x.sku === finalItem.sku ? { ...x, qty: x.qty + qty } : x
        );
      }

      return [
        ...prev,
        {
          sku: finalItem.sku,
          name: finalItem.name,
          pack: finalItem.pack,
          brand: finalItem.brand,
          status: finalItem.status,
          qty,
        },
      ];
    });

    setSkuInput("");
    setQtyInput(1);
    setSelectedItem(null);
    focusSkuInput();
  };

  const handleEnterAdd = () => {
    if (exactSkuMatch) {
      addToCart(exactSkuMatch);
      return;
    }

    addToCart();
  };

  const updateQty = (sku: string, qty: number) => {
    const safeQty = Math.max(1, Number(qty) || 1);
    setCart((prev) =>
      prev.map((item) => (item.sku === sku ? { ...item, qty: safeQty } : item))
    );
  };

  const removeItem = (sku: string) => {
    setCart((prev) => prev.filter((item) => item.sku !== sku));
  };

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);

  const downloadCSV = () => {
    if (!cart.length) return;

    const rows = [
      ["Account Number", accountNo],
      ["Store Name", storeName],
      ["Notes", notes],
      [],
      ["SKU", "Brand", "Description", "Pack", "Status", "Qty"],
      ...cart.map((item) => [
        item.sku,
        item.brand || "",
        item.name || "",
        item.pack || "",
        item.status || "",
        item.qty.toString(),
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell ?? ""}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `${accountNo || "customer"}_order_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitOrder = async () => {
    if (!accountNo.trim()) {
      alert("Please enter customer account number.");
      return;
    }

    if (!storeName.trim()) {
      alert("Please enter store name.");
      return;
    }

    if (!cart.length) {
      alert("Please add at least 1 item.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/send-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNo,
          storeName,
          notes,
          items: cart,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || "Failed to submit order.");
      } else {
        alert("Order submitted successfully.");
        setCart([]);
        setSkuInput("");
        setQtyInput(1);
        setSelectedItem(null);
        setNotes("");
        focusSkuInput();
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "20px 14px 40px",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              marginBottom: 6,
              color: "#111827",
            }}
          >
            Rhee Bros Customer Order
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Search by SKU / barcode / item name / brand. Auto-select first match.
            Press Enter to Add.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "1fr 2fr",
            alignItems: "start",
            marginBottom: 18,
          }}
        >
          {/* Customer Info */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <h2
              style={{
                fontWeight: 800,
                marginBottom: 12,
                fontSize: 16,
                color: "#111827",
              }}
            >
              Customer Info
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value.toUpperCase())}
                placeholder="Account Number (ex: FL410)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                }}
              />

              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Store Name"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                }}
              />

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note (optional)"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Add Items */}
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 14,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <h2
              style={{
                fontWeight: 800,
                marginBottom: 12,
                fontSize: 16,
                color: "#111827",
              }}
            >
              Add Items
            </h2>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <input
                ref={skuInputRef}
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleEnterAdd();
                  }
                }}
                placeholder="SKU / Barcode / Item Name / Brand"
                style={{
                  width: 300,
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  fontSize: 14,
                  outline: "none",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13, color: "#4b5563" }}>Qty</span>
                <input
                  type="number"
                  min="1"
                  value={qtyInput}
                  onChange={(e) =>
                    setQtyInput(Math.max(1, Number(e.target.value) || 1))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEnterAdd();
                    }
                  }}
                  style={{
                    width: 72,
                    padding: "10px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 14,
                    textAlign: "center",
                    outline: "none",
                  }}
                />
              </div>

              <button
                onClick={() => handleEnterAdd()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Add
              </button>
            </div>

            {selectedItem ? (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  fontSize: 13,
                  color: "#1e3a8a",
                }}
              >
                <div style={{ fontWeight: 700, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>Selected: {selectedItem.sku}</span>
                  {selectedItem.brand ? <span>| {selectedItem.brand}</span> : null}
                </div>
                <div style={{ marginTop: 2 }}>{selectedItem.name || "-"}</div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                    fontSize: 12,
                  }}
                >
                  <span>{selectedItem.pack || "-"}</span>
                  {selectedItem.status ? (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontWeight: 700,
                        ...getStatusBadgeStyle(selectedItem.status),
                      }}
                    >
                      {selectedItem.status}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              style={{
                border: "1px solid #eef2f7",
                borderRadius: 10,
                overflow: "hidden",
                background: "#fafafa",
                minHeight: 80,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {!normalizedInput || normalizedInput.length < 3 ? (
                <div
                  style={{
                    padding: 14,
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  Type at least 3 characters to search catalog...
                </div>
              ) : suggestions.length === 0 ? (
                <div
                  style={{
                    padding: 14,
                    color: "#6b7280",
                    fontSize: 14,
                  }}
                >
                  No matching items found.
                </div>
              ) : (
                suggestions.map((item, index) => {
                  const isSelected = selectedItem?.sku === item.sku;

                  return (
                    <button
                      key={`${item.sku}-${index}`}
                      onClick={() => {
                        setSelectedItem(item);
                        setSkuInput(item.sku);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderBottom:
                          index !== suggestions.length - 1
                            ? "1px solid #edf2f7"
                            : "none",
                        background: isSelected ? "#eff6ff" : "#fff",
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: "#111827",
                              fontSize: 14,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <span>{item.sku}</span>
                            {item.brand ? (
                              <span style={{ color: "#2563eb", fontWeight: 700 }}>
                                | {item.brand}
                              </span>
                            ) : null}
                          </div>

                          <div
                            style={{
                              fontSize: 13,
                              color: "#374151",
                              marginTop: 2,
                              lineHeight: 1.35,
                            }}
                          >
                            {item.name || "-"}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: "#6b7280",
                              marginTop: 4,
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <span>{item.pack || "-"}</span>
                            {item.status ? (
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  fontWeight: 700,
                                  ...getStatusBadgeStyle(item.status),
                                }}
                              >
                                {item.status}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: isSelected ? "#1d4ed8" : "#6b7280",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            marginTop: 2,
                          }}
                        >
                          {isSelected ? "Selected" : "Select"}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Order Cart */}
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 16,
            background: "#fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontWeight: 800,
                fontSize: 18,
                color: "#111827",
              }}
            >
              Order Cart
            </h2>

            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                fontSize: 14,
                color: "#4b5563",
              }}
            >
              <span>
                <strong>{cart.length}</strong> SKUs
              </span>
              <span>
                <strong>{totalQty}</strong> Qty
              </span>
            </div>
          </div>

          {!cart.length ? (
            <div
              style={{
                border: "1px dashed #d1d5db",
                borderRadius: 10,
                padding: 20,
                color: "#6b7280",
                fontSize: 14,
                background: "#fafafa",
              }}
            >
              No items added yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cart.map((item) => (
                <div
                  key={item.sku}
                  style={{
                    border: "1px solid #eef2f7",
                    borderRadius: 10,
                    padding: 10,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(220px, 1fr) auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          color: "#111827",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <span>{item.sku}</span>
                        {item.brand ? (
                          <span style={{ color: "#2563eb", fontWeight: 700 }}>
                            | {item.brand}
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: "#374151",
                          lineHeight: 1.3,
                          marginTop: 2,
                        }}
                      >
                        {item.name || "-"}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          marginTop: 4,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span>{item.pack || "-"}</span>
                        {item.status ? (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontWeight: 700,
                              ...getStatusBadgeStyle(item.status),
                            }}
                          >
                            {item.status}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#4b5563" }}>Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          updateQty(item.sku, Number(e.target.value || 1))
                        }
                        style={{
                          width: 72,
                          padding: "7px 8px",
                          textAlign: "center",
                          border: "1px solid #d1d5db",
                          borderRadius: 8,
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => removeItem(item.sku)}
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          borderRadius: 8,
                          fontSize: 13,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={downloadCSV}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Download CSV
            </button>

            <button
              onClick={submitOrder}
              disabled={loading}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: loading ? "#93c5fd" : "#2563eb",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {loading ? "Submitting..." : "Submit Order"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}