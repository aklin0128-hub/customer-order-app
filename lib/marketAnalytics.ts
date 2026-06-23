import { getAllCustomers } from "@/lib/customers";
import {
  UNASSIGNED_REGION,
  marketRegionLabel,
  type CustomerRegionValue,
} from "@/lib/customerRegion";
import { resolveInvoiceCaseUnitPrice } from "@/lib/invoice/invoiceCaseUnitPrice";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export type MarketPeriod = "biweekly" | "monthly" | "quarterly" | "year";

type OrderHistoryEntry = {
  accountNo?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
};

export type PeriodWindow = {
  start: string;
  end: string;
  label: string;
};

export type PeriodMetrics = {
  qty: number;
  revenue: number;
  invoiceCount: number;
  activeAccounts: number;
};

export type GrowthMetrics = {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  qtyGrowthPct: number | null;
  revenueGrowthPct: number | null;
};

export type RegionGrowthRow = {
  region: CustomerRegionValue;
  label: string;
  accountCount: number;
  growth: GrowthMetrics;
};

export type AccountGrowthRow = {
  accountNo: string;
  storeName: string;
  region: CustomerRegionValue;
  regionLabel: string;
  /** Account exists in customers.csv or Redis customer record */
  inCustomerList: boolean;
  growth: GrowthMetrics;
};

export type MarketAnalyticsResult = {
  period: MarketPeriod;
  currentWindow: PeriodWindow;
  previousWindow: PeriodWindow;
  regions: RegionGrowthRow[];
  accounts: AccountGrowthRow[];
  summary: {
    totalAccounts: number;
    assignedAccounts: number;
    /** Customers in directory without a region set */
    customersWithoutRegion: number;
    /** Sales accounts (invoice/order) showing as unassigned region */
    unassignedSalesAccounts: number;
    importCount: number;
    linesInRange: number;
  };
};

type MutableBucket = {
  qty: number;
  revenue: number;
  invoiceKeys: Set<string>;
};

function cleanSku(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function parseQty(value: unknown) {
  const num = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function parseDate(value: unknown) {
  const text = String(value || "").trim();
  if (!text) return null;

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const y = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    const m = Number(us[1]) - 1;
    const d = Number(us[2]);
    const date = new Date(Date.UTC(y, m, d, 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}

function addUtcDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function endOfUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12));
}

function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

function finalizeBucket(bucket: MutableBucket): PeriodMetrics {
  return {
    qty: bucket.qty,
    revenue: Math.round(bucket.revenue * 100) / 100,
    invoiceCount: bucket.invoiceKeys.size,
    activeAccounts: 0,
  };
}

function buildGrowth(current: MutableBucket, previous: MutableBucket): GrowthMetrics {
  const cur = finalizeBucket(current);
  const prev = finalizeBucket(previous);
  return {
    current: cur,
    previous: prev,
    qtyGrowthPct: growthPct(cur.qty, prev.qty),
    revenueGrowthPct: growthPct(cur.revenue, prev.revenue),
  };
}

export function getMarketPeriodWindows(period: MarketPeriod, now = new Date()): {
  current: PeriodWindow;
  previous: PeriodWindow;
} {
  const today = startOfUtcDay(now);

  if (period === "biweekly") {
    const curEnd = today;
    const curStart = addUtcDays(curEnd, -13);
    const prevEnd = addUtcDays(curStart, -1);
    const prevStart = addUtcDays(prevEnd, -13);
    return {
      current: {
        start: formatDate(curStart),
        end: formatDate(curEnd),
        label: `${formatDate(curStart)} → ${formatDate(curEnd)}`,
      },
      previous: {
        start: formatDate(prevStart),
        end: formatDate(prevEnd),
        label: `${formatDate(prevStart)} → ${formatDate(prevEnd)}`,
      },
    };
  }

  if (period === "monthly") {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    const curStart = new Date(Date.UTC(y, m - 1, 1, 12));
    const curEnd = endOfUtcMonth(y, m - 1);
    const prevStart = new Date(Date.UTC(y, m - 2, 1, 12));
    const prevEnd = endOfUtcMonth(y, m - 2);
    return {
      current: {
        start: formatDate(curStart),
        end: formatDate(curEnd),
        label: `${formatDate(curStart)} → ${formatDate(curEnd)}`,
      },
      previous: {
        start: formatDate(prevStart),
        end: formatDate(prevEnd),
        label: `${formatDate(prevStart)} → ${formatDate(prevEnd)}`,
      },
    };
  }

  if (period === "quarterly") {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth();
    const q = Math.floor(m / 3);
    const curQ = q === 0 ? { year: y - 1, qi: 3 } : { year: y, qi: q - 1 };
    const prevQ = curQ.qi === 0 ? { year: curQ.year - 1, qi: 3 } : { year: curQ.year, qi: curQ.qi - 1 };
    const curStart = new Date(Date.UTC(curQ.year, curQ.qi * 3, 1, 12));
    const curEnd = endOfUtcMonth(curQ.year, curQ.qi * 3 + 2);
    const prevStart = new Date(Date.UTC(prevQ.year, prevQ.qi * 3, 1, 12));
    const prevEnd = endOfUtcMonth(prevQ.year, prevQ.qi * 3 + 2);
    return {
      current: {
        start: formatDate(curStart),
        end: formatDate(curEnd),
        label: `Q${curQ.qi + 1} ${curQ.year}`,
      },
      previous: {
        start: formatDate(prevStart),
        end: formatDate(prevEnd),
        label: `Q${prevQ.qi + 1} ${prevQ.year}`,
      },
    };
  }

  const y = today.getUTCFullYear();
  const curStart = new Date(Date.UTC(y, 0, 1, 12));
  const curEnd = today;
  const prevStart = new Date(Date.UTC(y - 1, 0, 1, 12));
  const prevEnd = new Date(Date.UTC(y - 1, today.getUTCMonth(), today.getUTCDate(), 12));

  return {
    current: {
      start: formatDate(curStart),
      end: formatDate(curEnd),
      label: `YTD ${y}`,
    },
    previous: {
      start: formatDate(prevStart),
      end: formatDate(prevEnd),
      label: `YTD ${y - 1} (same dates)`,
    },
  };
}

function dateInWindow(date: Date | null, start: Date, end: Date) {
  if (!date) return false;
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function emptyBucket(): MutableBucket {
  return { qty: 0, revenue: 0, invoiceKeys: new Set() };
}

function addPurchase(
  bucket: MutableBucket,
  qty: number,
  unitPrice: number | null,
  invoiceKey: string
) {
  if (qty <= 0) return;
  bucket.qty += qty;
  if (unitPrice !== null && Number.isFinite(unitPrice)) {
    bucket.revenue += qty * unitPrice;
  }
  if (invoiceKey) bucket.invoiceKeys.add(invoiceKey);
}

export async function getMarketAnalytics(period: MarketPeriod): Promise<MarketAnalyticsResult> {
  const { current: currentWindow, previous: previousWindow } = getMarketPeriodWindows(period);
  const curStart = parseDate(currentWindow.start)!;
  const curEnd = parseDate(currentWindow.end)!;
  const prevStart = parseDate(previousWindow.start)!;
  const prevEnd = parseDate(previousWindow.end)!;

  const customers = await getAllCustomers();
  const regionByAccount = new Map<string, CustomerRegionValue>();
  const storeByAccount = new Map<string, string>();

  for (const c of customers) {
    const acct = c.accountNo.toUpperCase();
    regionByAccount.set(acct, c.region || UNASSIGNED_REGION);
    storeByAccount.set(acct, c.storeName || "");
  }

  const accountBuckets = new Map<
    string,
    { current: MutableBucket; previous: MutableBucket }
  >();

  function getAccountBuckets(accountNo: string) {
    const existing = accountBuckets.get(accountNo);
    if (existing) return existing;
    const next = { current: emptyBucket(), previous: emptyBucket() };
    accountBuckets.set(accountNo, next);
    return next;
  }

  let importCount = 0;
  let linesInRange = 0;

  const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
  importCount = imports.length;

  for (const record of imports) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    const inCurrent = dateInWindow(effectiveDate, curStart, curEnd);
    const inPrevious = dateInWindow(effectiveDate, prevStart, prevEnd);
    if (!inCurrent && !inPrevious) continue;

    const invoiceKey = `inv:${record.id}`;
    const buckets = getAccountBuckets(acct);

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const qty = parseQty(line.qty);
      if (!sku || qty <= 0) continue;

      const unitPrice =
        resolveInvoiceCaseUnitPrice({
          qty: line.qty,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        }) ?? null;

      if (inCurrent) {
        addPurchase(buckets.current, qty, unitPrice, invoiceKey);
        linesInRange += 1;
      }
      if (inPrevious) {
        addPurchase(buckets.previous, qty, unitPrice, invoiceKey);
        linesInRange += 1;
      }
    }
  }

  const { listOrderHistoryAccounts } = await import("@/lib/redisIndexes");
  const historyAccounts = await listOrderHistoryAccounts();
  const histories = await Promise.all(
    historyAccounts.map(async (accountNo) => ({
      accountNo,
      entries: (await redis.get<OrderHistoryEntry[]>(`orderHistory:${accountNo}`)) || [],
    }))
  );

  for (const { accountNo: keyAccountNo, entries } of histories) {
    for (const entry of entries) {
      const acct = String(entry.accountNo || keyAccountNo).trim().toUpperCase();
      if (!acct) continue;

      const entryDate = parseDate(entry.createdAt);
      const inCurrent = dateInWindow(entryDate, curStart, curEnd);
      const inPrevious = dateInWindow(entryDate, prevStart, prevEnd);
      if (!inCurrent && !inPrevious) continue;

      const orderKey = `ord:${entry.createdAt || ""}:${acct}`;
      const buckets = getAccountBuckets(acct);

      for (const item of entry.items || []) {
        const sku = cleanSku(item.sku);
        const qty = parseQty(item.qty);
        if (!sku || qty <= 0) continue;

        if (inCurrent) addPurchase(buckets.current, qty, null, orderKey);
        if (inPrevious) addPurchase(buckets.previous, qty, null, orderKey);
      }
    }
  }

  const regionIds: CustomerRegionValue[] = [
    "miami",
    "orlando",
    "melbourne",
    "jacksonville",
    UNASSIGNED_REGION,
  ];

  const customerAccounts = new Set(customers.map((c) => c.accountNo.toUpperCase()));

  const regionAgg = new Map<
    CustomerRegionValue,
    { current: MutableBucket; previous: MutableBucket }
  >();

  for (const id of regionIds) {
    regionAgg.set(id, { current: emptyBucket(), previous: emptyBucket() });
  }

  const accountRows: AccountGrowthRow[] = [];

  for (const [acct, buckets] of accountBuckets) {
    const region = regionByAccount.get(acct) || UNASSIGNED_REGION;
    const growth = buildGrowth(buckets.current, buckets.previous);
    growth.current.activeAccounts = growth.current.qty > 0 ? 1 : 0;
    growth.previous.activeAccounts = growth.previous.qty > 0 ? 1 : 0;

    accountRows.push({
      accountNo: acct,
      storeName: storeByAccount.get(acct) || "",
      region,
      regionLabel: marketRegionLabel(region),
      inCustomerList: customerAccounts.has(acct),
      growth,
    });

    const reg = regionAgg.get(region)!;
    reg.current.qty += buckets.current.qty;
    reg.current.revenue += buckets.current.revenue;
    buckets.current.invoiceKeys.forEach((k) => reg.current.invoiceKeys.add(k));
    reg.previous.qty += buckets.previous.qty;
    reg.previous.revenue += buckets.previous.revenue;
    buckets.previous.invoiceKeys.forEach((k) => reg.previous.invoiceKeys.add(k));
  }

  accountRows.sort((a, b) => b.growth.current.qty - a.growth.current.qty);

  const activeByRegion = new Map<
    CustomerRegionValue,
    { current: number; previous: number }
  >();
  for (const id of regionIds) activeByRegion.set(id, { current: 0, previous: 0 });
  for (const row of accountRows) {
    const slot = activeByRegion.get(row.region)!;
    if (row.growth.current.qty > 0) slot.current += 1;
    if (row.growth.previous.qty > 0) slot.previous += 1;
  }

  const regionAccountSets = new Map<CustomerRegionValue, Set<string>>();
  for (const id of regionIds) regionAccountSets.set(id, new Set());
  for (const row of accountRows) {
    regionAccountSets.get(row.region)?.add(row.accountNo);
  }

  const regions: RegionGrowthRow[] = regionIds.map((region) => {
    const agg = regionAgg.get(region)!;
    const growth = buildGrowth(agg.current, agg.previous);
    const active = activeByRegion.get(region)!;
    growth.current.activeAccounts = active.current;
    growth.previous.activeAccounts = active.previous;

    return {
      region,
      label: marketRegionLabel(region),
      accountCount: regionAccountSets.get(region)?.size || 0,
      growth,
    };
  });

  regions.sort((a, b) => {
    if (a.region === UNASSIGNED_REGION) return 1;
    if (b.region === UNASSIGNED_REGION) return -1;
    return b.growth.current.qty - a.growth.current.qty;
  });

  const assignedAccounts = customers.filter((c) => c.region).length;
  const customersWithoutRegion = customers.length - assignedAccounts;
  const unassignedSalesAccounts = accountRows.filter((r) => r.region === UNASSIGNED_REGION).length;

  return {
    period,
    currentWindow,
    previousWindow,
    regions,
    accounts: accountRows,
    summary: {
      totalAccounts: customers.length,
      assignedAccounts,
      customersWithoutRegion,
      unassignedSalesAccounts,
      importCount,
      linesInRange,
    },
  };
}
