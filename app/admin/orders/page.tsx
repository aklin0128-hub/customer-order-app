"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import {
  BtnSecondary,
  EmptyState,
  StatGrid,
  Toast,
  downloadOrderCsv,
  formatDate,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type OrderItem = { sku: string; qty: string };

type OrderRecord = {
  accountNo: string;
  storeName?: string;
  orderRef?: string;
  phone?: string;
  note?: string;
  items?: OrderItem[];
  createdAt?: string;
};

export default function AdminOrdersPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [search, setSearch] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const loadOrders = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/orders", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load orders.");
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setSelectedOrderKeys([]);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load orders.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authed) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return orders;
    return orders.filter((o) => {
      return (
        o.accountNo?.toUpperCase().includes(q) ||
        o.storeName?.toUpperCase().includes(q) ||
        o.orderRef?.toUpperCase().includes(q)
      );
    });
  }, [orders, search]);

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return orders.filter((o) => String(o.createdAt || "").startsWith(today)).length;
  }, [orders]);

  const orderKey = (o: OrderRecord, index: number) =>
    `${o.accountNo}-${o.orderRef || ""}-${o.createdAt || ""}-${index}`;

  const stableOrderKey = (o: OrderRecord) =>
    `${o.accountNo || ""}|${o.orderRef || ""}|${o.createdAt || ""}`;

  const selectedOrders = filteredOrders.filter((order) =>
    selectedOrderKeys.includes(stableOrderKey(order))
  );

  const allVisibleSelected =
    filteredOrders.length > 0 &&
    filteredOrders.every((order) => selectedOrderKeys.includes(stableOrderKey(order)));

  const toggleOrderSelection = (order: OrderRecord) => {
    const key = stableOrderKey(order);
    setSelectedOrderKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const bulkDownloadOrders = () => {
    selectedOrders.forEach((order, index) => {
      setTimeout(() => {
        downloadOrderCsv({
          accountNo: order.accountNo,
          orderRef: order.orderRef,
          items: order.items,
        });
      }, index * 200);
    });
  };

  const deleteOrders = async (targets: OrderRecord[], options: { skipConfirm?: boolean } = {}) => {
    if (targets.length === 0) return;
    if (!options.skipConfirm && !confirm(`Delete ${targets.length} selected order(s)? This cannot be undone.`)) return;

    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          orders: targets.map((order) => ({
            accountNo: order.accountNo,
            orderRef: order.orderRef,
            createdAt: order.createdAt,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete orders.");

      const deletedKeys = new Set(targets.map(stableOrderKey));
      setOrders((prev) => prev.filter((order) => !deletedKeys.has(stableOrderKey(order))));
      setSelectedOrderKeys((prev) => prev.filter((key) => !deletedKeys.has(key)));
      setExpandedKey(null);
      setMsg(`Deleted ${data.deletedCount || 0} order(s).`);
      setMsgTone("success");
    } catch (err: any) {
      setMsg(err?.message || "Failed to delete orders.");
      setMsgTone("error");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Orders"
        subtitle="Sign in to view customer order history from Redis."
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
      active="orders"
      title="Orders"
      subtitle="Recent orders saved when customers submit (up to 20 per account)."
      onLogout={logout}
      actions={
        <BtnSecondary onClick={loadOrders} disabled={busy}>
          {busy ? "Loading..." : "Refresh"}
        </BtnSecondary>
      }
    >
      <StatGrid
        items={[
          { label: "Total shown", value: filteredOrders.length },
          { label: "Today", value: todayCount },
          { label: "Accounts", value: new Set(orders.map((o) => o.accountNo)).size },
        ]}
      />

      <section style={panel}>
        <h2 style={panelTitle}>Order history</h2>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account, store name, or order ref..."
          style={{ ...inputStyle, marginBottom: 10 }}
        />

        <Toast message={msg} tone={msgTone} />

        {filteredOrders.length === 0 ? (
          <EmptyState
            title={orders.length === 0 ? "No orders yet" : "No matching orders"}
            detail={
              orders.length === 0
                ? "Orders appear here after customers submit on the order page."
                : "Try a different search term."
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 2 }}>
              <button
                type="button"
                onClick={() =>
                  setSelectedOrderKeys(allVisibleSelected ? [] : filteredOrders.map(stableOrderKey))
                }
                disabled={busy}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  borderRadius: 10,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {allVisibleSelected ? "Clear selection" : "Select all shown"}
              </button>
              <button
                type="button"
                onClick={bulkDownloadOrders}
                disabled={busy || selectedOrders.length === 0}
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: 10,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: busy || selectedOrders.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Download selected ({selectedOrders.length})
              </button>
              <button
                type="button"
                onClick={() => void deleteOrders(selectedOrders)}
                disabled={busy || selectedOrders.length === 0}
                style={{
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  borderRadius: 10,
                  padding: "7px 10px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: busy || selectedOrders.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete selected ({selectedOrders.length})
              </button>
            </div>
            {filteredOrders.map((order, index) => {
              const key = orderKey(order, index);
              const expanded = expandedKey === key;
              const itemCount = order.items?.length || 0;
              const caseTotal = (order.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
              const selected = selectedOrderKeys.includes(stableOrderKey(order));

              return (
                <article
                  key={key}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    background: "#fff",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      background: expanded ? "#eff6ff" : "#fff",
                      padding: "14px 16px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOrderSelection(order)}
                        disabled={busy}
                        style={{ marginTop: 3 }}
                        aria-label={`Select order ${order.orderRef || key}`}
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expanded ? null : key)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                          {order.accountNo} · {order.storeName || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                          Ref: {order.orderRef || "—"} · {itemCount} lines · {caseTotal} cases
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {formatDate(order.createdAt)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadOrderCsv({
                            accountNo: order.accountNo,
                            orderRef: order.orderRef,
                            items: order.items,
                          })
                        }
                        title="Download order CSV"
                        aria-label={`Download order ${order.orderRef || key}`}
                        style={{
                          border: "1px solid #bfdbfe",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          borderRadius: 10,
                          width: 34,
                          height: 34,
                          fontSize: 16,
                          fontWeight: 900,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteOrders([order])}
                        disabled={busy}
                        title="Delete order"
                        aria-label={`Delete order ${order.orderRef || key}`}
                        style={{
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          color: "#b91c1c",
                          borderRadius: 10,
                          width: 34,
                          height: 34,
                          fontSize: 16,
                          fontWeight: 900,
                          cursor: busy ? "not-allowed" : "pointer",
                          flexShrink: 0,
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid #e5e7eb" }}>
                      {order.phone || order.note ? (
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "12px 0 8px" }}>
                          {order.phone ? `Phone: ${order.phone}` : ""}
                          {order.phone && order.note ? " · " : ""}
                          {order.note ? `Note: ${order.note}` : ""}
                        </p>
                      ) : null}

                      <div
                        style={{
                          maxHeight: 220,
                          overflowY: "auto",
                          border: "1px solid #f3f4f6",
                          borderRadius: 10,
                          background: "#fafafa",
                        }}
                      >
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                              <th style={{ padding: "8px 10px" }}>SKU</th>
                              <th style={{ padding: "8px 10px" }}>Qty</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(order.items || []).map((item) => (
                              <tr key={`${item.sku}-${item.qty}`} style={{ borderTop: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 700 }}>{item.sku}</td>
                                <td style={{ padding: "8px 10px" }}>{item.qty}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
