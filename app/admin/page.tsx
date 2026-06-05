"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPage } from "./_components/AdminPage";
import { GrowthCell } from "./_components/admin-analytics-ui";
import { panel, panelTitle } from "./_components/admin-styles";
import { BtnPrimary, BtnSecondary, StatGrid, Toast } from "./_components/admin-utils";
import { useAdminAuth } from "./_components/useAdminAuth";

type DashboardData = {
  kpis: {
    ordersLast7Days: number;
    atRiskCustomers: number;
    silentCustomers: number;
    unassignedRegions: number;
    invoicesLast30Days: number;
    unknownSkuCount: number;
    activePromotions: number;
    activeClearance: number;
    activeCarts: number;
    staleCarts: number;
    invoicePricingCustomers: number;
  };
  alerts: { id: string; label: string; count: number; href: string; tone: string }[];
  invoiceQuality: {
    totalImports: number;
    last30Days: number;
    missingAccount: number;
    zeroLines: number;
    unknownSkuSet: string[];
  };
  promoEffectiveness: {
    sku: string;
    note?: string;
    status: string;
    qtyRecent28: number;
    qtyPrior28: number;
    changePct: number | null;
  }[];
  clearanceUrgent: {
    sku: string;
    daysUntilExpiry: number | null;
    remainingQty: number | null;
    clearancePrice: string;
  }[];
  cartFollowUps: {
    accountNo: string;
    storeName: string;
    totalCases: number;
    daysSinceUpdate: number | null;
  }[];
  restockLeads: {
    accountNo: string;
    storeName: string;
    sku: string;
    productName: string;
    daysSincePurchase: number;
    purchaseCount: number;
  }[];
};

function alertToneClass(tone: string): string {
  if (tone === "danger") return "admin-alert-card--danger";
  if (tone === "warn") return "admin-alert-card--warn";
  return "admin-alert-card--default";
}

export default function AdminDashboardPage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setSectionsLoading(true);
    setMsg("");
    try {
      const headers = adminHeaders();
      const kpisRes = await fetch("/api/admin/dashboard?part=kpis", { cache: "no-store", headers });
      const kpisJson = await kpisRes.json();
      if (!kpisRes.ok) throw new Error(kpisJson?.error || "Failed to load dashboard.");
      setData((prev) => ({
        ...(prev || ({} as DashboardData)),
        kpis: kpisJson.kpis,
        alerts: kpisJson.alerts,
        invoiceQuality: prev?.invoiceQuality || {
          totalImports: 0,
          last30Days: 0,
          missingAccount: 0,
          zeroLines: 0,
          unknownSkuSet: [],
        },
        promoEffectiveness: prev?.promoEffectiveness || [],
        clearanceUrgent: prev?.clearanceUrgent || [],
        cartFollowUps: prev?.cartFollowUps || [],
        restockLeads: prev?.restockLeads || [],
      }));
      setBusy(false);

      const secRes = await fetch("/api/admin/dashboard?part=sections", { cache: "no-store", headers });
      const secJson = await secRes.json();
      if (!secRes.ok) throw new Error(secJson?.error || "Failed to load dashboard sections.");
      setData((prev) =>
        prev
          ? {
              ...prev,
              invoiceQuality: secJson.invoiceQuality,
              promoEffectiveness: secJson.promoEffectiveness,
              clearanceUrgent: secJson.clearanceUrgent,
              cartFollowUps: secJson.cartFollowUps,
              restockLeads: secJson.restockLeads,
            }
          : null
      );
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setBusy(false);
      setSectionsLoading(false);
    }
  }, [adminHeaders]);

  const copyRestockSkus = (accountNo: string, skus: string[]) => {
    const text = skus.join("\n");
    void navigator.clipboard?.writeText(text);
    setMsg(`Copied ${skus.length} SKU(s) for ${accountNo}.`);
  };

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  return (
    <AdminPage
      active="home"
      title="Dashboard"
      subtitle="What needs attention today — then jump into the right tool."
      loginTitle="Admin sign in"
      loginSubtitle="Operations dashboard for customers, catalog, orders, and reports."
      actions={
        <BtnPrimary onClick={() => void load()} disabled={busy}>
          {busy ? "Refreshing…" : "Refresh"}
        </BtnPrimary>
      }
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      {data ? (
        <>
          <StatGrid
            items={[
              { label: "Orders (7 days)", value: data.kpis.ordersLast7Days },
              { label: "At risk", value: data.kpis.atRiskCustomers },
              { label: "Silent customers", value: data.kpis.silentCustomers },
              { label: "No region set", value: data.kpis.unassignedRegions },
              { label: "Invoices (30d)", value: data.kpis.invoicesLast30Days },
              { label: "Unknown SKUs", value: data.kpis.unknownSkuCount },
              { label: "Active carts", value: data.kpis.activeCarts },
              { label: "Stale carts (3d+)", value: data.kpis.staleCarts },
              { label: "Invoice prices ON", value: data.kpis.invoicePricingCustomers },
            ]}
          />

          {data.alerts.length ? (
            <section style={panel}>
              <h2 style={panelTitle}>Needs attention</h2>
              <div className="admin-alert-grid">
                {data.alerts.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className={`admin-alert-card ${alertToneClass(a.tone)}`}
                  >
                    <div className="admin-alert-card-count">{a.count}</div>
                    <div className="admin-alert-card-label">{a.label}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="admin-dashboard-grid">
            <section style={panel}>
              <h2 style={panelTitle}>Invoice data quality</h2>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280" }}>
                {data.invoiceQuality.totalImports} imports total · {data.invoiceQuality.last30Days} in last 30
                days · {data.invoiceQuality.missingAccount} missing account · {data.invoiceQuality.zeroLines}{" "}
                empty parses
              </p>
              {data.invoiceQuality.unknownSkuSet.length ? (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: "#b45309" }}>
                  {data.invoiceQuality.unknownSkuSet.length} unknown SKUs — add to catalog or fix imports.
                </p>
              ) : null}
              <Link href="/admin/invoices">
                <BtnSecondary>Open Invoices →</BtnSecondary>
              </Link>
            </section>

            <section style={panel}>
              <h2 style={panelTitle}>Promotion pulse (28d vs prior 28d)</h2>
              {data.promoEffectiveness.length ? (
                <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {data.promoEffectiveness.map((p) => (
                    <li key={p.sku}>
                      <strong>{p.sku}</strong>
                      {p.note ? ` · ${p.note}` : ""} — {p.qtyRecent28} cs{" "}
                      <GrowthCell
                        pct={p.changePct}
                        current={p.qtyRecent28}
                        previous={p.qtyPrior28}
                        showDelta={false}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "#6b7280" }}>No active promotions.</p>
              )}
              <Link href="/admin/promotions#promo-roi">
                <BtnSecondary>Promo ROI →</BtnSecondary>
              </Link>
            </section>

            <section style={panel}>
              <h2 style={panelTitle}>Clearance — expiring soon</h2>
              {data.clearanceUrgent.length ? (
                <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {data.clearanceUrgent.map((c) => (
                    <li key={c.sku}>
                      <strong>{c.sku}</strong> · {c.clearancePrice} ·{" "}
                      {c.daysUntilExpiry != null ? `${c.daysUntilExpiry}d left` : "no expiry"} · left{" "}
                      {c.remainingQty ?? "∞"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "#6b7280" }}>Nothing urgent.</p>
              )}
              <Link href="/admin/clearance">
                <BtnSecondary>Open clearance</BtnSecondary>
              </Link>
            </section>

            <section style={panel}>
              <h2 style={panelTitle}>Cart follow-ups</h2>
              {data.cartFollowUps.length ? (
                <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {data.cartFollowUps.map((c) => (
                    <li key={c.accountNo}>
                      <Link href={`/admin/account?accountNo=${encodeURIComponent(c.accountNo)}`}>
                        {c.accountNo}
                      </Link>
                      {c.storeName ? ` · ${c.storeName}` : ""} — {c.totalCases} cs
                      {c.daysSinceUpdate != null ? ` · ${c.daysSinceUpdate}d ago` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "#6b7280" }}>No open carts.</p>
              )}
              <Link href="/admin/active-carts">
                <BtnSecondary>Active carts</BtnSecondary>
              </Link>
            </section>

            <section style={panel}>
              <h2 style={panelTitle}>Restock opportunities</h2>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280" }}>
                Bought 2+ times in 180d, not in last 42d (invoice data).
              </p>
              {sectionsLoading && !data.restockLeads.length ? (
                <p style={{ fontSize: 13, color: "#6b7280" }}>Loading leads…</p>
              ) : data.restockLeads.length ? (
                <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                  {data.restockLeads.map((r) => (
                    <li key={`${r.accountNo}-${r.sku}`}>
                      <Link href={`/admin/account?accountNo=${encodeURIComponent(r.accountNo)}`}>
                        {r.accountNo}
                      </Link>
                      {" · "}
                      <strong>{r.sku}</strong>
                      {r.productName ? ` ${r.productName}` : ""} — {r.daysSincePurchase}d ago ({r.purchaseCount}{" "}
                      buys){" "}
                      <button
                        type="button"
                        onClick={() => copyRestockSkus(r.accountNo, [r.sku])}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#2563eb",
                          fontWeight: 800,
                          cursor: "pointer",
                          fontSize: 12,
                          padding: 0,
                        }}
                      >
                        Copy SKU
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 13, color: "#6b7280" }}>No leads right now.</p>
              )}
            </section>
          </div>

          <section style={panel}>
            <h2 style={panelTitle}>Quick links</h2>
            <div className="admin-quick-links-compact">
              <Link href="/admin/account">Account 360</Link>
              <Link href="/admin/inventory">Inventory expiry</Link>
              <Link href="/admin/active-carts?stale=1">Stale carts</Link>
              <Link href="/admin/price-compare">Price compare</Link>
              <Link href="/admin/invoices">Invoices</Link>
              <Link href="/admin/insights">Insights</Link>
              <Link href="/admin/promotions">Promotions</Link>
              <Link href="/admin/orders">Orders</Link>
              <Link href="/admin/customers">Customers</Link>
            </div>
          </section>
        </>
      ) : busy ? (
        <section style={panel}>
          <p style={{ margin: 0, color: "#2563eb", fontWeight: 800 }}>Loading dashboard…</p>
        </section>
      ) : null}
    </AdminPage>
  );
}
