import { cleanSku, loadInvoiceImports, parseDate, parseQty } from "@/lib/analyticsCommon";
import { getAllCustomers, normalizeAccountNo } from "@/lib/customers";
import { marketRegionLabel, type MarketRegionId } from "@/lib/customerRegion";
import { buildLatestInvoicePricesFromImports } from "@/lib/invoiceLatestPrices";
import { getMarketPeriodWindows } from "@/lib/marketAnalytics";
import { loadAllOrderHistories, type OrderHistoryEntry } from "@/lib/orderHistory";

export type WeeklySalesReportRow = {
  weekday: string;
  cid: string;
  storeName: string;
  sales: number | null;
  gpPercent: number | null;
  insights: string;
  notes: string;
  orderRef: string;
  orderDate: string;
};

export type WeeklySalesReportInput = {
  region: MarketRegionId;
  startDate: string;
  endDate: string;
  reportDate?: string;
  regionCode?: string;
  sid?: string;
  visitArea?: string;
  marketOverview?: string;
  productUpdate?: string;
  competitorInsight?: string;
  suggestions?: string;
};

export type WeeklySalesReportResult = {
  meta: {
    reportDate: string;
    regionCode: string;
    sid: string;
    visitArea: string;
    marketOverview: string;
    productUpdate: string;
    competitorInsight: string;
    suggestions: string;
    periodLabel: string;
    region: MarketRegionId;
    regionLabel: string;
    orderCount: number;
    totalSales: number | null;
    averageGpPercent: number | null;
  };
  rows: WeeklySalesReportRow[];
};

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function averageGpPercent(rows: WeeklySalesReportRow[]): number | null {
  const values = rows
    .map((r) => r.gpPercent)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!values.length) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) / 100;
}

export function mergeWeeklySalesRowOverrides(
  rows: WeeklySalesReportRow[],
  overrides?: Partial<Pick<WeeklySalesReportRow, "insights" | "gpPercent" | "notes">>[]
): WeeklySalesReportRow[] {
  if (!overrides?.length) return rows;
  return rows.map((row, index) => {
    const patch = overrides[index];
    if (!patch) return row;
    return {
      ...row,
      insights: patch.insights !== undefined ? String(patch.insights) : row.insights,
      notes: patch.notes !== undefined ? String(patch.notes) : row.notes,
      gpPercent:
        patch.gpPercent !== undefined
          ? patch.gpPercent === null || patch.gpPercent === ("" as unknown as number)
            ? null
            : Number(patch.gpPercent)
          : row.gpPercent,
    };
  });
}

export function padEmptyWeekdays(rows: WeeklySalesReportRow[]): WeeklySalesReportRow[] {
  const byDay = new Map<string, WeeklySalesReportRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.weekday) || [];
    list.push(row);
    byDay.set(row.weekday, list);
  }

  const result: WeeklySalesReportRow[] = [];
  for (const day of WEEKDAY_ORDER) {
    const list = byDay.get(day);
    if (list?.length) {
      result.push(...list);
      continue;
    }
    result.push({
      weekday: day,
      cid: "",
      storeName: "",
      sales: null,
      gpPercent: null,
      insights: "",
      notes: "",
      orderRef: "",
      orderDate: "",
    });
  }
  return result;
}

function finalizeReportMeta(
  rows: WeeklySalesReportRow[],
  partial: Omit<WeeklySalesReportResult["meta"], "orderCount" | "totalSales" | "averageGpPercent">
): WeeklySalesReportResult["meta"] {
  let totalSales: number | null = null;
  let pricedRows = 0;
  for (const row of rows) {
    if (row.sales == null) continue;
    totalSales = (totalSales ?? 0) + row.sales;
    pricedRows += 1;
  }
  if (pricedRows === 0) totalSales = null;
  else totalSales = Math.round((totalSales ?? 0) * 100) / 100;

  return {
    ...partial,
    orderCount: rows.filter((r) => r.cid).length,
    totalSales,
    averageGpPercent: averageGpPercent(rows),
  };
}

function formatUsDate(iso: string) {
  const d = parseDate(iso);
  if (!d) return iso;
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  return `${m}/${day}/${y}`;
}

function weekdayInFlorida(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(d);
  if (!WEEKDAY_ORDER.includes(label as (typeof WEEKDAY_ORDER)[number])) return null;
  return label;
}

function dateInRange(iso: string, start: Date, end: Date) {
  const d = parseDate(iso);
  if (!d) return false;
  const ms = d.getTime();
  return ms >= start.getTime() && ms <= end.getTime();
}

export function buildInvoicePriceMap(rows: { account: string; sku: string; price: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const account = normalizeAccountNo(row.account);
    const sku = cleanSku(row.sku);
    if (!account || !sku) continue;
    map.set(`${account}|${sku}`, row.price);
  }
  return map;
}

export function estimateOrderSales(
  accountNo: string,
  items: { sku?: string; qty?: string | number }[],
  priceMap: Map<string, number>
): number | null {
  const account = normalizeAccountNo(accountNo);
  let total = 0;
  let priced = false;

  for (const item of items || []) {
    const sku = cleanSku(item.sku);
    const qty = parseQty(item.qty);
    if (!sku || qty <= 0) continue;
    const unit = priceMap.get(`${account}|${sku}`);
    if (unit == null || !Number.isFinite(unit)) continue;
    total += unit * qty;
    priced = true;
  }

  return priced ? Math.round(total * 100) / 100 : null;
}

function isCustomerPortalOrder(entry: OrderHistoryEntry) {
  return String(entry.source || "").trim().toLowerCase() !== "invoice_upload";
}

export async function buildWeeklySalesReport(
  input: WeeklySalesReportInput
): Promise<WeeklySalesReportResult> {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end) {
    throw new Error("Invalid start or end date.");
  }
  if (start.getTime() > end.getTime()) {
    throw new Error("Start date must be on or before end date.");
  }

  const customers = await getAllCustomers();
  const accountsInRegion = new Set(
    customers
      .filter((c) => c.region === input.region)
      .map((c) => normalizeAccountNo(c.accountNo))
      .filter(Boolean)
  );

  const noteByAccount = new Map<string, string>();
  for (const c of customers) {
    const acct = normalizeAccountNo(c.accountNo);
    if (!acct || c.region !== input.region) continue;
    if (c.note) noteByAccount.set(acct, c.note);
  }

  const imports = await loadInvoiceImports();
  const priceMap = buildInvoicePriceMap(buildLatestInvoicePricesFromImports(imports));

  const matchedOrders: {
    weekday: string;
    entry: OrderHistoryEntry;
    sales: number | null;
  }[] = [];

  const histories = await loadAllOrderHistories();
  for (const { accountNo, entries } of histories) {
    const acct = normalizeAccountNo(accountNo);
    if (!accountsInRegion.has(acct)) continue;

    for (const entry of entries) {
      if (!isCustomerPortalOrder(entry)) continue;
      if (!dateInRange(entry.createdAt, start, end)) continue;
      const weekday = weekdayInFlorida(entry.createdAt);
      if (!weekday) continue;

      matchedOrders.push({
        weekday,
        entry: { ...entry, accountNo: acct },
        sales: estimateOrderSales(acct, entry.items, priceMap),
      });
    }
  }

  matchedOrders.sort((a, b) => {
    const dayCmp =
      WEEKDAY_ORDER.indexOf(a.weekday as (typeof WEEKDAY_ORDER)[number]) -
      WEEKDAY_ORDER.indexOf(b.weekday as (typeof WEEKDAY_ORDER)[number]);
    if (dayCmp !== 0) return dayCmp;
    return String(a.entry.createdAt).localeCompare(String(b.entry.createdAt));
  });

  const rows: WeeklySalesReportRow[] = matchedOrders.map(({ weekday, entry, sales }) => ({
    weekday,
    cid: entry.accountNo,
    storeName: entry.storeName || "",
    sales,
    gpPercent: null,
    insights: String(entry.note || "").trim() || noteByAccount.get(entry.accountNo) || "",
    notes: "",
    orderRef: entry.orderRef || "",
    orderDate: formatUsDate(entry.createdAt),
  }));

  const visitArea =
    String(input.visitArea || "").trim() ||
    marketRegionLabel(input.region).toUpperCase();

  return {
    meta: finalizeReportMeta(rows, {
      reportDate: formatUsDate(input.reportDate || input.endDate),
      regionCode: String(input.regionCode || "SE").trim().toUpperCase() || "SE",
      sid: String(input.sid || "832").trim().toUpperCase() || "832",
      visitArea,
      marketOverview: String(input.marketOverview || "").trim(),
      productUpdate: String(input.productUpdate || "").trim(),
      competitorInsight: String(input.competitorInsight || "").trim(),
      suggestions: String(input.suggestions || "").trim(),
      periodLabel: `${formatUsDate(input.startDate)} → ${formatUsDate(input.endDate)}`,
      region: input.region,
      regionLabel: marketRegionLabel(input.region),
    }),
    rows,
  };
}

export function applyWeeklySalesOverrides(
  report: WeeklySalesReportResult,
  overrides?: Partial<Pick<WeeklySalesReportRow, "insights" | "gpPercent" | "notes">>[]
): WeeklySalesReportResult {
  const rows = mergeWeeklySalesRowOverrides(report.rows, overrides);
  const { orderCount: _o, totalSales: _t, averageGpPercent: _a, ...rest } = report.meta;
  return {
    rows,
    meta: finalizeReportMeta(rows, rest),
  };
}

export function defaultBiweeklyReportRange(now = new Date()) {
  const { current } = getMarketPeriodWindows("biweekly", now);
  return { startDate: current.start, endDate: current.end };
}
