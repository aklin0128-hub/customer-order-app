"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
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
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { AdminSkuAutocomplete } from "../_components/AdminSkuAutocomplete";
import { inputStyle, panel, panelTitle } from "../_components/admin-styles";
import {
  BtnPrimary,
  BtnSecondary,
  FilterChips,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

type Tab = "health" | "brands" | "price";

type HealthRow = {
  accountNo: string;
  storeName: string;
  regionLabel: string;
  lastInvoiceDate: string | null;
  daysSinceInvoice: number | null;
  qty90: number;
  revenue90: number;
  qty90PriorYear: number;
  yoyQtyGrowthPct: number | null;
  status: string;
  statusLabel: string;
  hasInvoiceData90d: boolean;
  topSkus90d: { sku: string; qty: number }[];
};

type HealthData = {
  rows: HealthRow[];
  summary: {
    active: number;
    silent: number;
    atRisk: number;
    inactive: number;
    newCount: number;
  };
};

type ShareSegment = {
  label: string;
  qty: number;
  revenue: number;
  sharePct: number;
  color: string;
};

type SkuMover = {
  sku: string;
  name: string;
  brand: string;
  currentQty: number;
  previousQty: number;
  changePct: number | null;
};

type BrandData = {
  window: { label: string };
  previousWindow: { label: string };
  segments: ShareSegment[];
  topGroups: ShareSegment[];
  risingSkus: SkuMover[];
  fallingSkus: SkuMover[];
  summary: { totalQty: number; totalRevenue: number; skuCount: number };
};

type PriceData = {
  sku: string;
  product: { name: string; brand: string; category: string } | null;
  summary: {
    accountCount: number;
    min: number | null;
    max: number | null;
    median: number | null;
  };
  accounts: { accountNo: string; storeName: string; latestPrice: number; latestDate: string }[];
};

const TABS: { id: Tab; label: string }[] = [
  { id: "health", label: "Customer health" },
  { id: "brands", label: "Brand & category" },
  { id: "price", label: "Price distribution" },
];

const DAY_OPTS = [
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "180", label: "180 days" },
  { id: "365", label: "1 year" },
  { id: "0", label: "All" },
];

const STATUS_STYLE: Record<string, CSSProperties> = {
  active: { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" },
  silent: { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" },
  at_risk: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
  inactive: { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" },
  new: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
};

function SharePie({ segments }: { segments: ShareSegment[] }) {
  const total = segments.reduce((s, x) => s + x.qty, 0);
  if (!total) return <p style={{ fontSize: 13, color: "#6b7280" }}>No sales in range.</p>;

  let acc = 0;
  const stops = segments.map((seg) => {
    const pct = (seg.qty / total) * 100;
    const start = acc;
    acc += pct;
    return `${seg.color} ${start}% ${acc}%`;
  });

  return (
    <div className="admin-insights-pie-wrap">
      <div
        className="admin-insights-pie"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
        aria-hidden
      />
      <ul className="admin-insights-pie-legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className="admin-insights-swatch" style={{ background: seg.color }} />
            <span>
              {seg.label} · {seg.sharePct.toFixed(1)}% · {seg.qty.toLocaleString()} cs
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoverTable({ rows }: { rows: SkuMover[] }) {
  return (
    <AnalyticsTableWrap>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={analyticsTh}>SKU</th>
            <th style={analyticsTh}>Cases</th>
            <th style={analyticsTh}>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={analyticsTd}>
                <strong>{r.sku}</strong>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{r.name || r.brand || "—"}</div>
              </td>
              <td style={analyticsTd}>
                {r.currentQty} <span style={{ color: "#9ca3af" }}>(was {r.previousQty})</span>
              </td>
              <td style={analyticsTd}>
                <GrowthCell pct={r.changePct} current={r.currentQty} previous={r.previousQty} showDelta={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AnalyticsTableWrap>
  );
}

function AdminInsightsPageInner() {
  const searchParams = useSearchParams();
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [tab, setTab] = useState<Tab>("health");
  const [msg, setMsg] = useState("");

  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthFilter, setHealthFilter] = useState(() => searchParams.get("status") || "all");
  const [healthRegion, setHealthRegion] = useState("all");
  const [healthSearch, setHealthSearch] = useState(() => searchParams.get("accountNo") || "");
  const [hideInactive, setHideInactive] = useState(true);
  const [busyHealth, setBusyHealth] = useState(false);
  const healthFetched = useRef(false);

  const [brandDays, setBrandDays] = useState("90");
  const [brandGroup, setBrandGroup] = useState<"brand" | "category">("brand");
  const [brands, setBrands] = useState<BrandData | null>(null);
  const [busyBrands, setBusyBrands] = useState(false);

  const [priceSku, setPriceSku] = useState("");
  const [priceDays, setPriceDays] = useState("180");
  const [price, setPrice] = useState<PriceData | null>(null);
  const [busyPrice, setBusyPrice] = useState(false);
  const loadHealth = useCallback(
    async (force = false) => {
      if (healthFetched.current && !force && health) return;
      setBusyHealth(true);
      setMsg("");
      try {
        const res = await fetch("/api/admin/customer-health", {
          cache: "no-store",
          headers: adminHeaders(),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load.");
        setHealth(json);
        healthFetched.current = true;
      } catch (err: any) {
        setMsg(err?.message || "Failed to load customer health.");
      } finally {
        setBusyHealth(false);
      }
    },
    [adminHeaders, health]
  );

  const loadBrands = useCallback(async () => {
    setBusyBrands(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/admin/brand-insights?days=${brandDays}&groupBy=${brandGroup}`,
        { cache: "no-store", headers: adminHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load.");
      setBrands(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load brand insights.");
    } finally {
      setBusyBrands(false);
    }
  }, [adminHeaders, brandDays, brandGroup]);

  const loadPrice = useCallback(async () => {
    const sku = priceSku.trim().toUpperCase();
    if (!sku) return setMsg("Enter a SKU.");
    setBusyPrice(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/admin/price-distribution?sku=${encodeURIComponent(sku)}&days=${priceDays}`,
        { cache: "no-store", headers: adminHeaders() }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load.");
      setPrice(json);
    } catch (err: any) {
      setMsg(err?.message || "Failed to load price distribution.");
      setPrice(null);
    } finally {
      setBusyPrice(false);
    }
  }, [adminHeaders, priceSku, priceDays]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "health") void loadHealth();
  }, [authed, tab, loadHealth]);

  useEffect(() => {
    if (!authed || tab !== "brands") return;
    void loadBrands();
  }, [authed, tab, brandDays, brandGroup, loadBrands]);

  const filteredHealth = useMemo(() => {
    if (!health) return [];
    const q = healthSearch.trim().toUpperCase();
    return health.rows.filter((r) => {
      if (hideInactive && r.status === "inactive" && r.qty90 === 0) return false;
      if (healthFilter !== "all" && r.status !== healthFilter) return false;
      if (healthRegion !== "all") {
        const regionId = MARKET_REGIONS.find((x) => x.label === r.regionLabel)?.id;
        if (healthRegion === "unassigned" && r.regionLabel !== "Unassigned") return false;
        if (healthRegion !== "unassigned" && regionId !== healthRegion) return false;
      }
      if (!q) return true;
      return r.accountNo.includes(q) || r.storeName.toUpperCase().includes(q);
    });
  }, [health, healthFilter, healthSearch, healthRegion, hideInactive]);

  const exportHealth = () => {
    downloadCsv(
      "customer-health.csv",
      [
        "Account",
        "Store",
        "Region",
        "Last invoice",
        "Days since",
        "90d cases",
        "90d revenue",
        "Prior year cases",
        "YoY %",
        "Status",
      ],
      filteredHealth.map((r) => [
        r.accountNo,
        r.storeName,
        r.regionLabel,
        r.lastInvoiceDate || "",
        r.daysSinceInvoice ?? "",
        r.qty90,
        r.revenue90,
        r.qty90PriorYear,
        r.yoyQtyGrowthPct?.toFixed(1) ?? "",
        r.statusLabel,
      ])
    );
  };

  const exportPrice = () => {
    if (!price) return;
    downloadCsv(
      `price-${price.sku}.csv`,
      ["Account", "Store", "Latest price", "Invoice date"],
      price.accounts.map((a) => [a.accountNo, a.storeName, a.latestPrice, a.latestDate])
    );
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Insights"
        subtitle="Customer health, brand share, and price distribution."
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
      active="insights"
      title="Insights"
      subtitle="Health · brand share · SKU pricing — export CSV for review."
      onLogout={logout}
    >
      <section style={panel}>
        <FilterChips value={tab} onChange={(v) => setTab(v as Tab)} options={TABS} />
      </section>

      {msg ? <Toast tone="error" message={msg} /> : null}

      {tab === "health" ? (
        <div className={`admin-analytics-loading-overlay${busyHealth && health ? " is-busy" : ""}`}>
          {health ? (
            <StatGrid
              items={[
                { label: "Active", value: health.summary.active },
                { label: "Silent", value: health.summary.silent },
                { label: "At risk", value: health.summary.atRisk },
                { label: "New", value: health.summary.newCount },
              ]}
            />
          ) : null}

          <Panel title={`Customer health (${filteredHealth.length})`}>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
              90-day volume vs same window last year. Assign regions in{" "}
              <Link href="/admin/customers">Customers</Link> for city breakdown.
            </p>
            <div className="admin-analytics-toolbar">
              <input
                value={healthSearch}
                onChange={(e) => setHealthSearch(e.target.value)}
                placeholder="Search account or store…"
                style={{ ...inputStyle, flex: "1 1 200px", margin: 0 }}
              />
              <BtnPrimary onClick={() => void loadHealth(true)} disabled={busyHealth}>
                {busyHealth ? "…" : "Refresh"}
              </BtnPrimary>
              <BtnSecondary onClick={exportHealth} disabled={!filteredHealth.length}>
                Export CSV
              </BtnSecondary>
            </div>
            <FilterChips
              value={healthFilter}
              onChange={setHealthFilter}
              options={[
                { id: "all", label: "All status" },
                { id: "at_risk", label: "At risk" },
                { id: "silent", label: "Silent" },
                { id: "active", label: "Active" },
                { id: "new", label: "New" },
                { id: "inactive", label: "Inactive" },
              ]}
            />
            <FilterChips
              value={healthRegion}
              onChange={setHealthRegion}
              options={[
                { id: "all", label: "All regions" },
                ...MARKET_REGIONS.map((r) => ({ id: r.id, label: r.label })),
                { id: "unassigned", label: "Unassigned" },
              ]}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, margin: "8px 0" }}>
              <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} />
              Hide inactive with zero 90-day sales
            </label>
            <AnalyticsTableWrap>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={analyticsTh}>Account</th>
                    <th style={analyticsTh}>Region</th>
                    <th style={analyticsTh}>Last invoice</th>
                    <th style={analyticsTh}>90d cs</th>
                    <th style={analyticsTh}>90d $</th>
                    <th style={analyticsTh}>YoY</th>
                    <th style={analyticsTh}>Status</th>
                    <th style={analyticsTh}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHealth.map((r) => (
                    <tr key={r.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={analyticsTd}>
                        <strong>{r.accountNo}</strong>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{r.storeName || "—"}</div>
                        {!r.hasInvoiceData90d && r.qty90 > 0 ? (
                          <div style={{ fontSize: 10, color: "#b45309", fontWeight: 800 }}>Order-only data</div>
                        ) : null}
                      </td>
                      <td style={analyticsTd}>{r.regionLabel}</td>
                      <td style={analyticsTd}>
                        {r.lastInvoiceDate || "—"}
                        {r.daysSinceInvoice !== null ? (
                          <span style={{ display: "block", fontSize: 10, color: "#9ca3af" }}>
                            {r.daysSinceInvoice}d ago
                          </span>
                        ) : null}
                      </td>
                      <td style={{ ...analyticsTd, fontWeight: 800 }}>{r.qty90.toLocaleString()}</td>
                      <td style={analyticsTd}>{formatMoney(r.revenue90)}</td>
                      <td style={analyticsTd}>
                        <GrowthCell pct={r.yoyQtyGrowthPct} current={r.qty90} previous={r.qty90PriorYear} />
                      </td>
                      <td style={analyticsTd}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            padding: "3px 8px",
                            borderRadius: 999,
                            ...(STATUS_STYLE[r.status] || STATUS_STYLE.inactive),
                          }}
                        >
                          {r.statusLabel}
                        </span>
                      </td>
                      <td style={analyticsTd}>
                        <Link
                          href={`/admin/account?accountNo=${encodeURIComponent(r.accountNo)}`}
                          style={{ fontSize: 12, fontWeight: 800 }}
                        >
                          360 →
                        </Link>
                        {r.status === "at_risk" && r.topSkus90d?.length ? (
                          <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                            Top: {r.topSkus90d.map((s) => s.sku).join(", ")}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AnalyticsTableWrap>
          </Panel>
          {busyHealth && !health ? (
            <p style={{ fontSize: 13, color: "#2563eb", fontWeight: 800 }}>Loading…</p>
          ) : null}
        </div>
      ) : null}

      {tab === "brands" ? (
        <>
          <section style={panel}>
            <h2 style={panelTitle}>Range</h2>
            <FilterChips value={brandDays} onChange={setBrandDays} options={DAY_OPTS} />
            <div style={{ marginTop: 10 }}>
              <FilterChips
                value={brandGroup}
                onChange={(v) => setBrandGroup(v as "brand" | "category")}
                options={[
                  { id: "brand", label: "By brand" },
                  { id: "category", label: "By category" },
                ]}
              />
            </div>
            <div className="admin-analytics-toolbar" style={{ marginTop: 10 }}>
              <BtnPrimary onClick={() => void loadBrands()} disabled={busyBrands}>
                {busyBrands ? "Loading…" : "Refresh"}
              </BtnPrimary>
            </div>
          </section>

          <div className={`admin-analytics-loading-overlay${busyBrands && brands ? " is-busy" : ""}`}>
            {brands ? (
              <>
                <StatGrid
                  items={[
                    { label: "Cases", value: brands.summary.totalQty },
                    { label: "Revenue", value: formatMoney(brands.summary.totalRevenue) },
                    { label: "SKUs", value: brands.summary.skuCount },
                  ]}
                />
                {brands.previousWindow.label !== "—" ? (
                  <PeriodBanner current={brands.window.label} previous={brands.previousWindow.label} />
                ) : (
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
                    <strong>Range:</strong> {brands.window.label}
                  </p>
                )}

                <div className="admin-insights-brand-grid">
                  <Panel title="Share">
                    <SharePie segments={brands.segments} />
                  </Panel>
                  <Panel title={`Top ${brandGroup === "brand" ? "brands" : "categories"}`}>
                    <AnalyticsTableWrap>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={analyticsTh}>Name</th>
                            <th style={analyticsTh}>Share</th>
                            <th style={analyticsTh}>Cases</th>
                            <th style={analyticsTh}>$</th>
                          </tr>
                        </thead>
                        <tbody>
                          {brands.topGroups.map((g) => (
                            <tr key={g.label} style={{ borderBottom: "1px solid #f3f4f6" }}>
                              <td style={{ ...analyticsTd, fontWeight: 800 }}>{g.label}</td>
                              <td style={analyticsTd}>{g.sharePct.toFixed(1)}%</td>
                              <td style={analyticsTd}>{g.qty.toLocaleString()}</td>
                              <td style={analyticsTd}>{formatMoney(g.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </AnalyticsTableWrap>
                  </Panel>
                </div>

                <div className="admin-insights-movers-grid">
                  <Panel title="Rising SKUs">
                    {brands.risingSkus.length ? (
                      <MoverTable rows={brands.risingSkus} />
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>None in this range.</p>
                    )}
                  </Panel>
                  <Panel title="Falling SKUs">
                    {brands.fallingSkus.length ? (
                      <MoverTable rows={brands.fallingSkus} />
                    ) : (
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>None in this range.</p>
                    )}
                  </Panel>
                </div>
              </>
            ) : busyBrands ? (
              <Panel title="Loading">
                <p style={{ margin: 0, color: "#2563eb", fontWeight: 800 }}>Loading…</p>
              </Panel>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === "price" ? (
        <>
          <section style={panel}>
            <h2 style={panelTitle}>SKU lookup</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8 }}>
              <AdminSkuAutocomplete
                value={priceSku}
                onChange={setPriceSku}
                placeholder="Type SKU or name…"
                onEnter={() => void loadPrice()}
              />
              <select value={priceDays} onChange={(e) => setPriceDays(e.target.value)} style={inputStyle}>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
              </select>
              <BtnPrimary onClick={() => void loadPrice()} disabled={busyPrice}>
                {busyPrice ? "…" : "Load"}
              </BtnPrimary>
            </div>
          </section>

          {price ? (
            <>
              <Panel title={`${price.sku}${price.product?.name ? ` · ${price.product.name}` : ""}`}>
                <StatGrid
                  items={[
                    { label: "Stores", value: price.summary.accountCount },
                    {
                      label: "Min",
                      value: price.summary.min != null ? `$${price.summary.min.toFixed(2)}` : "—",
                    },
                    {
                      label: "Median",
                      value: price.summary.median != null ? `$${price.summary.median.toFixed(2)}` : "—",
                    },
                    {
                      label: "Max",
                      value: price.summary.max != null ? `$${price.summary.max.toFixed(2)}` : "—",
                    },
                  ]}
                />
                <BtnSecondary onClick={exportPrice}>Export CSV</BtnSecondary>
              </Panel>
              <Panel title={`By store (${price.accounts.length})`}>
                <AnalyticsTableWrap>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={analyticsTh}>Account</th>
                        <th style={analyticsTh}>Price</th>
                        <th style={analyticsTh}>Spread</th>
                        <th style={analyticsTh}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {price.accounts.map((a) => {
                        const med = price.summary.median;
                        const spread =
                          med && med > 0 ? (((a.latestPrice - med) / med) * 100).toFixed(0) : null;
                        return (
                          <tr key={a.accountNo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={analyticsTd}>
                              <strong>{a.accountNo}</strong>
                              <div style={{ fontSize: 11, color: "#6b7280" }}>{a.storeName || "—"}</div>
                            </td>
                            <td style={{ ...analyticsTd, fontWeight: 900 }}>${a.latestPrice.toFixed(2)}</td>
                            <td style={analyticsTd}>
                              {spread !== null ? (
                                <span style={{ color: Number(spread) < 0 ? "#059669" : Number(spread) > 0 ? "#dc2626" : "#6b7280" }}>
                                  {Number(spread) > 0 ? "+" : ""}
                                  {spread}% vs median
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={analyticsTd}>{a.latestDate}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </AnalyticsTableWrap>
              </Panel>
            </>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}

export default function AdminInsightsPage() {
  return (
    <Suspense fallback={<p style={{ padding: 16, fontSize: 13, color: "#6b7280" }}>Loading insights…</p>}>
      <AdminInsightsPageInner />
    </Suspense>
  );
}
