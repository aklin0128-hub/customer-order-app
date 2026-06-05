"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminAccountAutocomplete } from "../_components/AdminAccountAutocomplete";
import { AdminPage } from "../_components/AdminPage";
import { GrowthCell } from "../_components/admin-analytics-ui";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import { BtnPrimary, BtnSecondary, Panel, StatGrid, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type Account360 = {
  accountNo: string;
  customer: {
    storeName: string;
    active: boolean;
    regionLabel: string;
    email?: string;
    phone?: string;
  } | null;
  health: {
    statusLabel: string;
    lastInvoiceDate: string | null;
    qty90: number;
    qty90PriorYear: number;
    revenue90: number;
    yoyQtyGrowthPct: number | null;
  } | null;
  recentOrders: { orderRef: string; createdAt: string; itemCount: number; totalCases: number }[];
  recentInvoices: { id: string; invoiceDate: string | null; uploadedAt: string; lineCount: number }[];
  topSkus: { sku: string; name: string; brand: string; qty: number }[];
  draft: { lineCount: number; totalCases: number; updatedAt: string } | null;
};

function Account360Content() {
  const searchParams = useSearchParams();
  const { authed, adminHeaders } = useAdminAuth();
  const [accountInput, setAccountInput] = useState(searchParams.get("accountNo") || "");
  const [data, setData] = useState<Account360 | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(
    async (acct?: string) => {
      const accountNo = (acct || accountInput).trim().toUpperCase();
      if (!accountNo) return setMsg("Enter account number.");
      setBusy(true);
      setMsg("");
      try {
        const res = await fetch(
          `/api/admin/account-360?accountNo=${encodeURIComponent(accountNo)}`,
          { cache: "no-store", headers: adminHeaders() }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load account.");
        setData(json);
        setAccountInput(accountNo);
        window.history.replaceState(null, "", `/admin/account?accountNo=${encodeURIComponent(accountNo)}`);
      } catch (err: unknown) {
        setMsg(err instanceof Error ? err.message : "Failed to load account.");
        setData(null);
      } finally {
        setBusy(false);
      }
    },
    [accountInput, adminHeaders]
  );

  useEffect(() => {
    if (!authed) return;
    const fromUrl = searchParams.get("accountNo");
    if (fromUrl) void load(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  return (
    <>
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Look up account</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px", minWidth: 0 }}>
            <AdminAccountAutocomplete
              value={accountInput}
              onChange={setAccountInput}
              placeholder="Account # or store name"
              onEnter={() => void load()}
            />
          </div>
          <BtnPrimary onClick={() => void load()} disabled={busy}>
            {busy ? "Loading..." : "Load"}
          </BtnPrimary>
          <Link href="/admin/customers">
            <BtnSecondary>Customers</BtnSecondary>
          </Link>
        </div>
      </section>

      {data ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Link href={`/admin/customers?accountNo=${encodeURIComponent(data.accountNo)}`}>
              <BtnSecondary>Edit customer</BtnSecondary>
            </Link>
            <Link href={`/admin/invoices?accountNo=${encodeURIComponent(data.accountNo)}`}>
              <BtnSecondary>Invoices</BtnSecondary>
            </Link>
            <Link href={`/admin/orders?q=${encodeURIComponent(data.accountNo)}`}>
              <BtnSecondary>Orders</BtnSecondary>
            </Link>
            <Link href={`/admin/price-compare?accountNo=${encodeURIComponent(data.accountNo)}`}>
              <BtnSecondary>Price compare</BtnSecondary>
            </Link>
          </div>
          <StatGrid
            items={[
              { label: "Store", value: data.customer?.storeName || "-" },
              { label: "Region", value: data.customer?.regionLabel || "-" },
              { label: "Health", value: data.health?.statusLabel || "-" },
              { label: "90d cases", value: data.health?.qty90 ?? "-" },
            ]}
          />

          {data.health ? (
            <section style={panel}>
              <h2 style={panelTitle}>Health</h2>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                Last invoice: {data.health.lastInvoiceDate || "-"} | YoY cases:{" "}
                <GrowthCell
                  pct={data.health.yoyQtyGrowthPct}
                  current={data.health.qty90}
                  previous={data.health.qty90PriorYear}
                />
              </p>
              <Link href="/admin/insights" style={{ fontSize: 13, fontWeight: 800 }}>
                Full insights
              </Link>
            </section>
          ) : null}

          {data.draft ? (
            <section style={panel}>
              <h2 style={panelTitle}>Open cart</h2>
              <p style={{ margin: 0, fontSize: 13 }}>
                {data.draft.lineCount} lines | {data.draft.totalCases} cases | updated{" "}
                {data.draft.updatedAt ? new Date(data.draft.updatedAt).toLocaleString() : "-"}
              </p>
              <Link href="/admin/active-carts">
                <BtnSecondary>View active carts</BtnSecondary>
              </Link>
            </section>
          ) : null}

          <Panel title="Top SKUs (90 days)">
            {data.topSkus.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                {data.topSkus.map((s) => (
                  <li key={s.sku}>
                    <strong>{s.sku}</strong>
                    {s.brand || s.name ? ` | ${s.brand || ""} ${s.name || ""}` : ""} - {s.qty} cs
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>No sales in last 90 days.</p>
            )}
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Panel title="Recent orders">
              {data.recentOrders.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                  {data.recentOrders.map((o, i) => (
                    <li key={i}>
                      {o.orderRef} | {o.totalCases} cs | {o.createdAt?.slice(0, 10) || "-"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>No orders.</p>
              )}
              <Link href={`/admin/orders?q=${encodeURIComponent(data.accountNo)}`} style={{ fontSize: 13, fontWeight: 800 }}>
                All orders
              </Link>
            </Panel>
            <Panel title="Recent invoices">
              {data.recentInvoices.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
                  {data.recentInvoices.map((inv) => (
                    <li key={inv.id}>
                      {inv.invoiceDate || inv.uploadedAt?.slice(0, 10)} | {inv.lineCount} lines
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>No imports.</p>
              )}
              <Link href={`/admin/invoices?accountNo=${encodeURIComponent(data.accountNo)}`} style={{ fontSize: 13, fontWeight: 800 }}>
                All invoices
              </Link>
            </Panel>
          </div>
        </>
      ) : null}
    </>
  );
}

export default function AdminAccountPage() {
  return (
    <AdminPage
      active="account"
      title="Account 360"
      subtitle="Orders, invoices, health, and top SKUs."
      loginSubtitle="One-page view of a customer account."
    >
      <Suspense fallback={<p style={{ fontSize: 13, color: "#6b7280" }}>Loading...</p>}>
        <Account360Content />
      </Suspense>
    </AdminPage>
  );
}
