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
            {filteredOrders.map((order, index) => {
              const key = orderKey(order, index);
              const expanded = expandedKey === key;
              const itemCount = order.items?.length || 0;
              const caseTotal = (order.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

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
                  <button
                    type="button"
                    onClick={() => setExpandedKey(expanded ? null : key)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: expanded ? "#eff6ff" : "#fff",
                      padding: "14px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                          {order.accountNo} · {order.storeName || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                          Ref: {order.orderRef || "—"} · {itemCount} lines · {caseTotal} cases
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                          {formatDate(order.createdAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>
                        {expanded ? "Hide" : "View"}
                      </span>
                    </div>
                  </button>

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

                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <BtnSecondary
                          onClick={() =>
                            downloadOrderCsv({
                              accountNo: order.accountNo,
                              orderRef: order.orderRef,
                              items: order.items,
                            })
                          }
                        >
                          Download CSV
                        </BtnSecondary>
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
