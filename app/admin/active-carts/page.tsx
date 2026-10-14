"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminPage } from "../_components/AdminPage";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import { downloadCsv } from "../_components/admin-analytics-ui";
import { BtnSecondary, EmptyState, FilterChips, StatGrid, Toast, formatDate } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type ActiveCart = {
  accountNo: string;
  storeName?: string;
  phone?: string;
  note?: string;
  updatedAt?: string;
  items: { sku: string; qty: string; addedAt?: string }[];
  lineCount: number;
  totalCases: number;
};

type StaleFilter = "all" | "stale";

function isStaleCart(cart: ActiveCart) {
  const t = cart.updatedAt ? new Date(cart.updatedAt).getTime() : 0;
  return t > 0 && Date.now() - t >= 3 * 24 * 60 * 60 * 1000;
}

function AdminActiveCartsContent() {
  const searchParams = useSearchParams();
  const { authed, adminHeaders } = useAdminAuth();
  const [carts, setCarts] = useState<ActiveCart[]>([]);
  const [search, setSearch] = useState("");
  const [staleFilter, setStaleFilter] = useState<StaleFilter>(
    searchParams.get("stale") === "1" ? "stale" : "all"
  );
  const [expandedAccount, setExpandedAccount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadCarts = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/active-carts", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load active carts.");
      setCarts(Array.isArray(data.carts) ? data.carts : []);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load active carts.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authed) loadCarts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const filteredCarts = useMemo(() => {
    const q = search.trim().toUpperCase();
    return carts.filter((cart) => {
      if (staleFilter === "stale" && !isStaleCart(cart)) return false;
      if (!q) return true;
      return (
        cart.accountNo.includes(q) ||
        cart.storeName?.toUpperCase().includes(q) ||
        cart.items.some((item) => item.sku.includes(q))
      );
    });
  }, [carts, search, staleFilter]);

  return (
    <AdminPage
      active="activeCarts"
      title="Active Carts"
      subtitle="Follow up on stale carts (3+ days) — call or email the store."
      actions={
        <>
          <BtnSecondary
            onClick={() => {
              downloadCsv(
                "active-carts.csv",
                ["accountNo", "storeName", "lineCount", "totalCases", "updatedAt", "phone", "note"],
                filteredCarts.map((c) => [
                  c.accountNo,
                  c.storeName || "",
                  c.lineCount,
                  c.totalCases,
                  c.updatedAt || "",
                  c.phone || "",
                  c.note || "",
                ])
              );
            }}
            disabled={!filteredCarts.length}
          >
            Export CSV
          </BtnSecondary>
          <BtnSecondary onClick={loadCarts} disabled={busy}>
            {busy ? "Loading..." : "Refresh"}
          </BtnSecondary>
        </>
      }
    >
      <StatGrid
        items={[
          { label: "Active carts", value: filteredCarts.length },
          { label: "Total lines", value: filteredCarts.reduce((sum, cart) => sum + cart.lineCount, 0) },
          { label: "Total cases", value: filteredCarts.reduce((sum, cart) => sum + cart.totalCases, 0) },
          {
            label: "Stale (3d+)",
            value: carts.filter(isStaleCart).length,
          },
        ]}
      />

      <section style={panel}>
        <h2 style={panelTitle}>Carts with items</h2>
        <FilterChips
          value={staleFilter}
          onChange={setStaleFilter}
          options={[
            { id: "all", label: "All carts" },
            { id: "stale", label: "Stale 3d+" },
          ]}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account, store, or SKU..."
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        {msg ? <Toast message={msg} tone="error" /> : null}

        {filteredCarts.length === 0 ? (
          <EmptyState title="No active carts" detail="Customers appear here after draft auto-save has items in cart." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredCarts
              .sort((a, b) => String(a.updatedAt || "").localeCompare(String(b.updatedAt || "")))
              .map((cart) => {
              const expanded = expandedAccount === cart.accountNo;
              const updatedMs = cart.updatedAt ? new Date(cart.updatedAt).getTime() : 0;
              const stale = isStaleCart(cart);
              return (
                <article
                  key={cart.accountNo}
                  className={stale ? "admin-stale-row" : undefined}
                  style={{ border: `1px solid ${stale ? "#fde68a" : "#e5e7eb"}`, borderRadius: 14, background: stale ? "#fffbeb" : "#fff", overflow: "hidden" }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedAccount(expanded ? "" : cart.accountNo)}
                    style={{ width: "100%", border: "none", background: expanded ? "#eff6ff" : "#fff", padding: 14, textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                          {cart.accountNo} · {cart.storeName || "—"}
                        </div>
                        <div style={{ fontSize: 12, color: stale ? "#b45309" : "#6b7280", marginTop: 4, fontWeight: stale ? 800 : 400 }}>
                          {cart.lineCount} lines · {cart.totalCases} cases · Updated {formatDate(cart.updatedAt)}
                          {stale ? " · follow up" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        <Link
                          href={`/admin/account?accountNo=${encodeURIComponent(cart.accountNo)}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}
                        >
                          Account 360 →
                        </Link>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#2563eb" }}>{expanded ? "Hide" : "View"}</span>
                      </div>
                    </div>
                  </button>

                  {expanded ? (
                    <div style={{ padding: "0 14px 14px", borderTop: "1px solid #e5e7eb" }}>
                      {cart.phone || cart.note ? (
                        <p style={{ fontSize: 12, color: "#6b7280", margin: "12px 0 8px" }}>
                          {cart.phone ? `Phone: ${cart.phone}` : ""}
                          {cart.phone && cart.note ? " · " : ""}
                          {cart.note ? `Note: ${cart.note}` : ""}
                        </p>
                      ) : null}
                      <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #f3f4f6", borderRadius: 10 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                              <th style={{ padding: "8px 10px" }}>SKU</th>
                              <th style={{ padding: "8px 10px" }}>Qty</th>
                              <th style={{ padding: "8px 10px" }}>Added</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cart.items.map((item) => (
                              <tr key={item.sku} style={{ borderTop: "1px solid #e5e7eb" }}>
                                <td style={{ padding: "8px 10px", fontWeight: 800 }}>{item.sku}</td>
                                <td style={{ padding: "8px 10px" }}>{item.qty}</td>
                                <td style={{ padding: "8px 10px", color: "#6b7280", whiteSpace: "nowrap" }}>
                                  {formatDate(item.addedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <BtnSecondary
                          onClick={() => {
                            downloadCsv(
                              `${cart.accountNo}_active-cart.csv`,
                              ["SKU", "Qty", "Added"],
                              cart.items.map((item) => [
                                item.sku,
                                item.qty,
                                item.addedAt || "",
                              ])
                            );
                          }}
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
    </AdminPage>
  );
}

export default function AdminActiveCartsPage() {
  return (
    <Suspense fallback={null}>
      <AdminActiveCartsContent />
    </Suspense>
  );
}
