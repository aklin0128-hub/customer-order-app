import catalogData from "@/data/catalog_sku_master_extracted.json";
import { getAllCustomers, normalizeAccountNo } from "@/lib/customers";
import {
  isMarketRegionId,
  marketRegionLabel,
  type MarketRegionId,
} from "@/lib/customerRegion";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
};

type OrderHistoryEntry = {
  accountNo?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
};

type SkuAccumulator = {
  sku: string;
  invoiceQty: number;
  orderQty: number;
  purchaseCount: number;
  accounts: Set<string>;
  accountQty: Map<string, number>;
};

export type TopSkuRegionFilter = MarketRegionId | "all" | "multi";

export type TopSkuRow = {
  rank: number;
  sku: string;
  name: string;
  brand: string;
  status: string;
  totalQty: number;
  invoiceQty: number;
  orderQty: number;
  accountCount: number;
  purchaseCount: number;
  topAccounts: { accountNo: string; qty: number }[];
};

export type TopSkusResult = {
  rows: TopSkuRow[];
  summary: {
    skuCount: number;
    totalQty: number;
    invoiceQty: number;
    orderQty: number;
    importCount: number;
    orderAccountCount: number;
    days: number | null;
    limit: number;
    region: TopSkuRegionFilter;
    regionLabel: string;
    regionAccountCount: number | null;
  };
};

export function normalizeTopSkuRegion(value: unknown): TopSkuRegionFilter {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw || raw === "all") return "all";
  if (raw === "multi" || raw === "multi-city" || raw === "multicity") return "multi";
  if (raw === "jax" || raw === "jacksonville") return "jacksonville";
  if (raw === "mia") return "miami";
  if (raw === "orl") return "orlando";
  if (raw === "mlb" || raw === "mel") return "melbourne";
  if (isMarketRegionId(raw)) return raw;
  return "all";
}

export function topSkuRegionLabel(region: TopSkuRegionFilter) {
  if (region === "all" || region === "multi") return "All / Multi-city";
  return marketRegionLabel(region);
}

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

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sinceFromDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function inRange(date: Date | null, since: Date | null) {
  if (!since) return true;
  if (!date) return true;
  return date >= since;
}

function getAccumulator(map: Map<string, SkuAccumulator>, sku: string) {
  const existing = map.get(sku);
  if (existing) return existing;

  const next: SkuAccumulator = {
    sku,
    invoiceQty: 0,
    orderQty: 0,
    purchaseCount: 0,
    accounts: new Set(),
    accountQty: new Map(),
  };
  map.set(sku, next);
  return next;
}

function addPurchase(
  map: Map<string, SkuAccumulator>,
  sku: string,
  accountNo: string,
  qty: number,
  source: "invoice" | "order"
) {
  if (!sku || qty <= 0 || !accountNo) return;

  const row = getAccumulator(map, sku);
  if (source === "invoice") row.invoiceQty += qty;
  else row.orderQty += qty;

  row.purchaseCount += 1;
  row.accounts.add(accountNo);
  row.accountQty.set(accountNo, (row.accountQty.get(accountNo) || 0) + qty);
}

async function buildProductMap(skus: string[]) {
  const wanted = new Set(skus.filter(Boolean));
  const map = new Map<string, Product>();

  for (const item of catalogData as Product[]) {
    const sku = cleanSku(item.sku);
    if (!sku || !wanted.has(sku)) continue;
    map.set(sku, { ...item, sku });
  }

  const redisItems = await Promise.all(
    Array.from(wanted).map((sku) => redis.get<Product>(`product:${sku}`))
  );

  for (const item of redisItems) {
    const sku = cleanSku(item?.sku);
    if (!sku) continue;
    map.set(sku, { ...(map.get(sku) || { sku }), ...item, sku });
  }

  return map;
}

async function buildRegionAccountSet(region: TopSkuRegionFilter): Promise<Set<string> | null> {
  if (region === "all" || region === "multi") return null;
  const customers = await getAllCustomers();
  return new Set(
    customers
      .filter((c) => c.region === region)
      .map((c) => normalizeAccountNo(c.accountNo))
      .filter(Boolean)
  );
}

export async function getTopSkus(options?: {
  days?: number;
  limit?: number;
  region?: TopSkuRegionFilter | string;
}): Promise<TopSkusResult> {
  const days = Number(options?.days || 0);
  const since = sinceFromDays(days);
  const limit = Math.min(500, Math.max(1, Number(options?.limit) || 100));
  const region = normalizeTopSkuRegion(options?.region);
  const allowedAccounts = await buildRegionAccountSet(region);

  const map = new Map<string, SkuAccumulator>();
  const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
  let matchedImportCount = 0;

  for (const record of imports) {
    const acct = normalizeAccountNo(record.accountNo || "");
    if (!acct) continue;
    if (allowedAccounts && !allowedAccounts.has(acct)) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!inRange(effectiveDate, since)) continue;

    matchedImportCount += 1;
    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const qty = parseQty(line.qty);
      addPurchase(map, sku, acct, qty, "invoice");
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

  let matchedOrderAccounts = 0;
  for (const { accountNo: keyAccountNo, entries } of histories) {
    let accountUsed = false;
    for (const entry of entries) {
      const entryAccountNo = normalizeAccountNo(entry.accountNo || keyAccountNo);
      if (!entryAccountNo) continue;
      if (allowedAccounts && !allowedAccounts.has(entryAccountNo)) continue;

      const entryDate = parseDate(entry.createdAt);
      if (!inRange(entryDate, since)) continue;

      accountUsed = true;
      for (const item of entry.items || []) {
        const sku = cleanSku(item.sku);
        const qty = parseQty(item.qty);
        addPurchase(map, sku, entryAccountNo, qty, "order");
      }
    }
    if (accountUsed) matchedOrderAccounts += 1;
  }

  const sorted = Array.from(map.values())
    .map((row) => ({
      ...row,
      totalQty: row.invoiceQty + row.orderQty,
    }))
    .filter((row) => row.totalQty > 0)
    .sort((a, b) => b.totalQty - a.totalQty || b.accounts.size - a.accounts.size || a.sku.localeCompare(b.sku));

  const topSlice = sorted.slice(0, limit);
  const productMap = await buildProductMap(topSlice.map((row) => row.sku));

  let totalInvoiceQty = 0;
  let totalOrderQty = 0;
  for (const row of sorted) {
    totalInvoiceQty += row.invoiceQty;
    totalOrderQty += row.orderQty;
  }

  const rows: TopSkuRow[] = topSlice.map((row, index) => {
    const product = productMap.get(row.sku);
    const topAccounts = Array.from(row.accountQty.entries())
      .map(([accountNo, qty]) => ({ accountNo, qty }))
      .sort((a, b) => b.qty - a.qty || a.accountNo.localeCompare(b.accountNo))
      .slice(0, 8);

    return {
      rank: index + 1,
      sku: row.sku,
      name: product?.name || "",
      brand: product?.brand || "",
      status: product?.status || "",
      totalQty: row.totalQty,
      invoiceQty: row.invoiceQty,
      orderQty: row.orderQty,
      accountCount: row.accounts.size,
      purchaseCount: row.purchaseCount,
      topAccounts,
    };
  });

  return {
    rows,
    summary: {
      skuCount: sorted.length,
      totalQty: totalInvoiceQty + totalOrderQty,
      invoiceQty: totalInvoiceQty,
      orderQty: totalOrderQty,
      importCount: allowedAccounts ? matchedImportCount : imports.length,
      orderAccountCount: allowedAccounts ? matchedOrderAccounts : histories.length,
      days: since ? days : null,
      limit,
      region,
      regionLabel: topSkuRegionLabel(region),
      regionAccountCount: allowedAccounts ? allowedAccounts.size : null,
    },
  };
}
