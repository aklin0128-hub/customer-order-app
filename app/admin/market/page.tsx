"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_REGIONS } from "@/lib/customerRegion";
import {
  AnalyticsTableWrap,
  GrowthCell,
  PeriodBanner,
  analyticsTd,
  analyticsTh,
  downloadCsv,
  formatMoney,
} from "../_components/admin-analytics-ui";
import { AdminPage } from "../_components/AdminPage";
import { inputStyle, panel, panelTitle, splitLayout } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnSecondary,
  FilterChips,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type MarketPeriod = "biweekly" | "monthly" | "quarterly" | "year";

type GrowthMetrics = {
  current: { qty: number; revenue: number; activeAccounts: number };
  previous: { qty: number; revenue: number; activeAccounts: number };
  qtyGrowthPct: number | null;
  revenueGrowthPct: number | null;
};

type MarketData = {
  period: MarketPeriod;
  currentWindow: { label: string };
  previousWindow: { label: string };
  regions: {
    region: string;
    label: string;
    accountCount: number;
    growth: GrowthMetrics;
  }[];
  accounts: {
    accountNo: string;
    storeName: string;
    region: string;
    regionLabel: string;
    inCustomerList: boolean;
    growth: GrowthMetrics;
  }[];
  summary: {
    assignedAccounts: number;
    customersWithoutRegion: number;
    unassignedSalesAccounts: number;
    importCount: number;
  };
};

const PERIOD_OPTIONS: { id: MarketPeriod; label: string; hint: string }[] = [
  { id: "biweekly", label: "2 weeks", hint: "Last 14 days vs prior 14" },
  { id: "monthly", label: "Monthly", hint: "Last full month vs prior month" },
  { id: "quarterly", label: "Quarterly", hint: "Last full quarter vs prior" },
  { id: "year", label: "YTD", hint: "Year-to-date vs same dates last year" },
];

type AccountSort = "growth" | "qty" | "account";

export default function AdminMarketPage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [period, setPeriod] = useState<MarketPeriod>("monthly");
  const [regionFilter, setRegionFilter] = useState("all");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountSort, setAccountSort] = useState<AccountSort>("qty");
  const [onlyWithSales, setOnlyWithSales] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [targets, setTargets] = useState<{ region: string; label: string; qTargetRevenue: number }[]>([]);
  const [targetsBusy, setTargetsBusy] = useState(false);
  const [data, setData] = useState<MarketData | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/market?period=${period}`, {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load market data.");
      setData(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load market data.");
    } finally {
      setBusy(false);
    }
  }, [adminHeaders, period]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  useEffect(() => {
    if (!authed) return;
    void fetch("/api/admin/market-targets", { headers: adminHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.regions)) setTargets(j.regions);
      })
      .catch(() => {});
  }, [authed, adminHeaders]);

  const saveTargets = async () => {
    setTargetsBusy(true);
    try {
      const res = await fetch("/api/admin/market-targets", {
        method: "POST",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ regions: targets }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Save failed");
      setTargets(j.regions || targets);
      setMsg("Targets saved.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setTargetsBusy(false);
    }
  };

  const filteredAccounts = useMemo(() => {
    if (!data) return [];
    const q = accountSearch.trim().toUpperCase();
    let rows = data.accounts.filter((row) => {
      if (regionFilter !== "all" && row.region !== regionFilter) return false;
      if (onlyWithSales && row.growth.current.qty === 0 && row.growth.previous.qty === 0) return false;
      if (!q) return true;
      return row.accountNo.toUpperCase().includes(q) || row.storeName.toUpperCase().includes(q);
    });

    rows = [...rows].sort((a, b) => {
      if (accountSort === "account") return a.accountNo.localeCompare(b.accountNo);
      if (accountSort === "growth") {
        const ga = a.growth.qtyGrowthPct ?? (a.growth.current.qty > 0 ? 9999 : -9999);
        const gb = b.growth.qtyGrowthPct ?? (b.growth.current.qty > 0 ? 9999 : -9999);
        return gb - ga;
      }
      return b.growth.current.qty - a.growth.current.qty;
    });
    return rows;
  }, [data, regionFilter, accountSearch, accountSort, onlyWithSales]);

  const exportRegions = () => {
    if (!data) return;
    downloadCsv(
      `market-regions-${period}.csv`,
      ["Region", "Accounts", "Cases current", "Cases previous", "Case growth %", "Revenue current", "Revenue growth %"],
      data.regions.map((r) => [
        r.label,
        r.accountCount,
        r.growth.current.qty,
        r.growth.previous.qty,
        r.growth.qtyGrowthPct?.toFixed(1) ?? "",
        r.growth.current.revenue,
        r.growth.revenueGrowthPct?.toFixed(1) ?? "",
      ])
    );
  };

  const exportAccounts = () => {
    if (!data) return;
    downloadCsv(
      `market-accounts-${period}.csv`,
      ["Account", "Store", "Region", "Cases current", "Cases previous", "Growth %", "Revenue current"],
      filteredAccounts.map((r) => [
        r.accountNo,
        r.storeName,
        r.regionLabel,
        r.growth.current.qty,
        r.growth.previous.qty,
        r.growth.qtyGrowthPct?.toFixed(1) ?? "",
        r.growth.current.revenue,
      ])
    );
  };

  const periodHint = PERIOD_OPTIONS.find((p) => p.id === period)?.hint || "";

  if (!authed) return null;

  return (
    <AdminPage
      active="market"
      title="Market by city"
      subtitle="Click a city to filter accounts · export CSV for reports."
    >
      {msg ? <Toast tone="error" message={msg} /> : null}

      <section style={panel}>
        <h2 style={panelTitle}>Comparison period</h2>
        <FilterChips value={period} onChange={(v) => setPeriod(v as MarketPeriod)} options={PERIOD_OPTIONS} />
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {periodHint}. Invoice date (or upload date) plus submitted orders.
        </p>
        <div className="admin-analytics-toolbar" style={{ marginTop: 10 }}>
          <BtnPrimary onClick={() => void load()} disabled={busy}>
            {busy ? "Loading…" : "Refresh"}
          </BtnPrimary>
          <Link href="/admin/customers" style={{ textDecoration: "none" }}>
            <BtnSecondary>Assign regions</BtnSecondary>
          </Link>
          {data ? (
            <>
              <BtnSecondary onClick={exportRegions}>Export cities</BtnSecondary>
              <BtnSecondary onClick={exportAccounts}>Export accounts</BtnSecondary>
            </>
          ) : null}
        </div>
      </section>

      <div className={`admin-analytics-loading-overlay${busy && data ? " is-busy" : ""}`}>
        {data ? (
          <>
            <StatGrid
              items={[
                { label: "With region", value: data.summary.assignedAccounts },
                { label: "Unassigned (sales)", value: data.summary.unassignedSalesAccounts },
                {
                  label: "Total cases",
                  value: data.regions.reduce((s, r) => s + r.growth.current.qty, 0),
                },
                {
                  label: "Total revenue",
                  value: formatMoney(data.regions.reduce((s, r) => s + r.growth.current.revenue, 0)),
                },
              ]}
            />

            <PeriodBanner current={data.currentWindow.label} previous={data.previousWindow.label} />

            <div style={splitLayout} className="admin-catalog-split admin-split">
              <Panel title="By city">
                {data.summary.unassignedSalesAccounts > 0 ? (
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: "#b45309", lineHeight: 1.45 }}>
                    <strong>{data.summary.unassignedSalesAccounts}</strong> sales account(s) with no region
                    {data.summary.customersWithoutRegion > 0 ? (
                      <>
                        {" "}
                        ({data.summary.customersWithoutRegion} in Customers without region)
                      </>
                    ) : null}
                    . Assign in{" "}
                    <Link href="/admin/customers">Customers</Link>
                    {data.summary.unassignedSalesAccounts > data.summary.customersWithoutRegion ? (
                      <>
                        {" "}
                        — some accounts only appear on invoices; add them in Customers first, then set region.
                      </>
                    ) : null}
                  </p>
                ) : null}
                <AnalyticsTableWrap>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={analyticsTh}>Region</th>
                        <th style={analyticsTh}>Cases</th>
                        <th style={analyticsTh}>Growth</th>
                        <th style={analyticsTh}>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.regions.map((row) => {
                        const active = regionFilter === row.region;
                        return (
                          <tr
                            key={row.region}
                            className={`admin-analytics-row-clickable${active ? " admin-analytics-row-clickable--active" : ""}`}
                            onClick={() => setRegionFilter(active ? "all" : row.region)}
                            style={{ borderBottom: "1px solid #f3f4f6" }}
                          >
                            <td style={{ ...analyticsTd, fontWeight: 900 }}>
                              {row.label}
                              <span style={{ display: "block", fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>
                                {row.accountCount} accounts
                              </span>
                            </td>
                            <td style={{ ...analyticsTd, fontWeight: 800 }}>{row.growth.current.qty.toLocaleString()}</td>
                            <td style={analyticsTd}>
                              <GrowthCell
                                pct={row.growth.qtyGrowthPct}
                                current={row.growth.current.qty}
                                previous={row.growth.previous.qty}
                              />
                            </td>
                            <td style={analyticsTd}>{formatMoney(row.growth.current.revenue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </AnalyticsTableWrap>
              </Panel>

              <Panel title={`Accounts (${filteredAccounts.length})`}>
                <div className="admin-analytics-toolbar">
                  <input
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Search…"
                    style={{ ...inputStyle, flex: "1 1 160px", margin: 0 }}
                  />
                  <select
                    value={accountSort}
                    onChange={(e) => setAccountSort(e.target.value as AccountSort)}
                    style={{ ...inputStyle, width: "auto", margin: 0 }}
                  >
                    <option value="qty">Sort: cases</option>
                    <option value="growth">Sort: growth %</option>
                    <option value="account">Sort: account</option>
                  </select>
                </div>
                <FilterChips
                  value={regionFilter}
                  onChange={setRegionFilter}
                  options={[
                    { id: "all", label: "All" },
                    ...MARKET_REGIONS.map((r) => ({ id: r.id, label: r.label })),
                    { id: "unassigned", label: "Unassigned" },
                  ]}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "8px 0" }}>
                  <input
                    type="checkbox"
                    checked={onlyWithSales}
                    onChange={(e) => setOnlyWithSales(e.target.checked)}
                  />
                  Only accounts with sales in either period
                </label>
                <AnalyticsTableWrap>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={analyticsTh}>Account</th>
                        <th style={analyticsTh}>Cases</th>
                        <th style={analyticsTh}>Growth</th>
                        <th style={analyticsTh}>Rev</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((row) => (
                        <tr key={row.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={analyticsTd}>
                            <strong>{row.accountNo}</strong>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>
                              {row.storeName || "—"} · {row.regionLabel}
                              {!row.inCustomerList ? (
                                <span style={{ display: "block", color: "#b45309", fontWeight: 800 }}>
                                  Not in Customers — add account to assign region
                                </span>
                              ) : row.region === "unassigned" ? (
                                <span style={{ display: "block" }}>
                                  <Link
                                    href={`/admin/customers?accountNo=${encodeURIComponent(row.accountNo)}`}
                                    style={{ fontWeight: 800 }}
                                  >
                                    Set region in Customers →
                                  </Link>
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ ...analyticsTd, fontWeight: 800 }}>{row.growth.current.qty.toLocaleString()}</td>
                          <td style={analyticsTd}>
                            <GrowthCell
                              pct={row.growth.qtyGrowthPct}
                              current={row.growth.current.qty}
                              previous={row.growth.previous.qty}
                            />
                          </td>
                          <td style={analyticsTd}>{formatMoney(row.growth.current.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AnalyticsTableWrap>
              </Panel>
            </div>
          </>
        ) : busy ? (
          <section style={panel}>
            <p style={{ margin: 0, fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading market data…</p>
          </section>
        ) : null}

        {targets.length ? (
          <section style={panel}>
            <h2 style={panelTitle}>Quarterly revenue targets (manual)</h2>
            <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
              {targets.map((t, i) => (
                <label key={t.region} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ width: 100, fontWeight: 800 }}>{t.label}</span>
                  <input
                    type="number"
                    min={0}
                    value={t.qTargetRevenue || ""}
                    onChange={(e) => {
                      const next = [...targets];
                      next[i] = { ...t, qTargetRevenue: Number(e.target.value) || 0 };
                      setTargets(next);
                    }}
                    style={inputStyle}
                  />
                </label>
              ))}
            </div>
            {data ? (
              <p style={{ fontSize: 12, color: "#6b7280", margin: "10px 0" }}>
                Current period revenue by region shown above — compare to targets manually.
              </p>
            ) : null}
            <BtnPrimary onClick={() => void saveTargets()} disabled={targetsBusy}>
              {targetsBusy ? "Saving…" : "Save targets"}
            </BtnPrimary>
          </section>
        ) : null}
      </div>
    </AdminPage>
  );
}
