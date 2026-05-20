import {
  addUtcDays,
  collectSaleEvents,
  formatDate,
  growthPct,
  loadInvoiceImports,
  parseDate,
  startOfUtcDay,
} from "@/lib/analyticsCommon";
import { cachedAnalytics } from "@/lib/analyticsCache";
import { getAllCustomers } from "@/lib/customers";
import { marketRegionLabel } from "@/lib/customerRegion";

export type CustomerHealthStatus = "active" | "silent" | "at_risk" | "inactive" | "new";

export type CustomerHealthRow = {
  accountNo: string;
  storeName: string;
  regionLabel: string;
  lastInvoiceDate: string | null;
  daysSinceInvoice: number | null;
  qty90: number;
  revenue90: number;
  qty90PriorYear: number;
  revenue90PriorYear: number;
  yoyQtyGrowthPct: number | null;
  yoyRevenueGrowthPct: number | null;
  status: CustomerHealthStatus;
  statusLabel: string;
  /** Has invoice in last 90 days — false means metrics may be order-only */
  hasInvoiceData90d: boolean;
  topSkus90d: { sku: string; qty: number }[];
};

export type CustomerHealthResult = {
  rows: CustomerHealthRow[];
  summary: {
    total: number;
    active: number;
    silent: number;
    atRisk: number;
    inactive: number;
    newCount: number;
  };
};

const STATUS_LABELS: Record<CustomerHealthStatus, string> = {
  active: "Active",
  silent: "Silent",
  at_risk: "At risk",
  inactive: "Inactive",
  new: "New",
};

function classifyHealth(
  daysSince: number | null,
  qty90: number,
  qty90Prior: number,
  yoyPct: number | null
): CustomerHealthStatus {
  if (qty90 > 0 && qty90Prior === 0) return "new";
  if (daysSince === null && qty90 === 0) return "inactive";
  if (daysSince !== null && daysSince > 365 && qty90 === 0) return "inactive";

  if (daysSince !== null && daysSince <= 30) return "active";
  if (daysSince !== null && daysSince <= 60) return "silent";

  if (daysSince !== null && daysSince > 60) return "at_risk";
  if (yoyPct !== null && yoyPct < -40 && qty90Prior >= 20) return "at_risk";

  if (qty90 > 0) return "active";
  return "inactive";
}

export async function getCustomerHealth(): Promise<CustomerHealthResult> {
  return cachedAnalytics("customerHealth", () => computeCustomerHealth());
}

export async function getCustomerHealthRow(accountNo: string): Promise<CustomerHealthRow | null> {
  const acct = accountNo.trim().toUpperCase();
  if (!acct) return null;
  const { rows } = await getCustomerHealth();
  return rows.find((r) => r.accountNo === acct) ?? null;
}

async function computeCustomerHealth(): Promise<CustomerHealthResult> {
  const today = startOfUtcDay(new Date());
  const start90 = addUtcDays(today, -89);
  const end90 = today;
  const start90Yoy = addUtcDays(start90, -365);
  const end90Yoy = addUtcDays(end90, -365);

  const customers = await getAllCustomers();
  const customerMap = new Map(
    customers.map((c) => [
      c.accountNo.toUpperCase(),
      {
        storeName: c.storeName,
        regionLabel: marketRegionLabel(c.region),
      },
    ])
  );

  const lastInvoiceByAccount = new Map<string, Date>();
  const imports = await loadInvoiceImports();
  for (const record of imports) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;
    const d = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!d) continue;
    const prev = lastInvoiceByAccount.get(acct);
    if (!prev || d > prev) lastInvoiceByAccount.set(acct, d);
  }

  const metrics = new Map<
    string,
    { qty90: number; rev90: number; qtyYoy: number; revYoy: number }
  >();
  const invoiceIn90d = new Set<string>();
  const skuQty90 = new Map<string, Map<string, number>>();

  for (const c of customers) {
    metrics.set(c.accountNo.toUpperCase(), { qty90: 0, rev90: 0, qtyYoy: 0, revYoy: 0 });
  }

  const events = await collectSaleEvents({ since: start90Yoy, until: end90 });
  for (const e of events) {
    const t = e.date.getTime();
    const row = metrics.get(e.accountNo) || { qty90: 0, rev90: 0, qtyYoy: 0, revYoy: 0 };
    if (t >= start90.getTime() && t <= end90.getTime()) {
      row.qty90 += e.qty;
      row.rev90 += e.revenue;
      if (e.source === "invoice") invoiceIn90d.add(e.accountNo);
      const skus = skuQty90.get(e.accountNo) || new Map();
      skus.set(e.sku, (skus.get(e.sku) || 0) + e.qty);
      skuQty90.set(e.accountNo, skus);
    }
    if (t >= start90Yoy.getTime() && t <= end90Yoy.getTime()) {
      row.qtyYoy += e.qty;
      row.revYoy += e.revenue;
    }
    metrics.set(e.accountNo, row);
  }

  const rows: CustomerHealthRow[] = [];

  for (const [acct, m] of metrics) {
    const meta = customerMap.get(acct);
    const lastInv = lastInvoiceByAccount.get(acct);
    const daysSince = lastInv
      ? Math.floor((today.getTime() - lastInv.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const yoyQty = growthPct(m.qty90, m.qtyYoy);
    const yoyRev = growthPct(m.rev90, m.revYoy);
    const status = classifyHealth(daysSince, m.qty90, m.qtyYoy, yoyQty);

    const topSkus90d = Array.from(skuQty90.get(acct)?.entries() || [])
      .map(([sku, qty]) => ({ sku, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    rows.push({
      accountNo: acct,
      storeName: meta?.storeName || "",
      regionLabel: meta?.regionLabel || "Unassigned",
      lastInvoiceDate: lastInv ? formatDate(lastInv) : null,
      daysSinceInvoice: daysSince,
      qty90: m.qty90,
      revenue90: Math.round(m.rev90 * 100) / 100,
      qty90PriorYear: m.qtyYoy,
      revenue90PriorYear: Math.round(m.revYoy * 100) / 100,
      yoyQtyGrowthPct: yoyQty,
      yoyRevenueGrowthPct: yoyRev,
      status,
      statusLabel: STATUS_LABELS[status],
      hasInvoiceData90d: invoiceIn90d.has(acct),
      topSkus90d,
    });
  }

  rows.sort((a, b) => {
    const order: Record<CustomerHealthStatus, number> = {
      at_risk: 0,
      silent: 1,
      inactive: 2,
      new: 3,
      active: 4,
    };
    const d = order[a.status] - order[b.status];
    if (d !== 0) return d;
    return (b.daysSinceInvoice ?? 9999) - (a.daysSinceInvoice ?? 9999);
  });

  const summary = {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    silent: rows.filter((r) => r.status === "silent").length,
    atRisk: rows.filter((r) => r.status === "at_risk").length,
    inactive: rows.filter((r) => r.status === "inactive").length,
    newCount: rows.filter((r) => r.status === "new").length,
  };

  return { rows, summary };
}
