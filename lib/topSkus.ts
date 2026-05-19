import catalogData from "@/data/catalog_sku_master_extracted.json";
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
  };
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

export async function getTopSkus(options?: {
  days?: number;
  limit?: number;
}): Promise<TopSkusResult> {
  const days = Number(options?.days || 0);
  const since = sinceFromDays(days);
  const limit = Math.min(500, Math.max(1, Number(options?.limit) || 100));

  const map = new Map<string, SkuAccumulator>();
  const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];

  for (const record of imports) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!inRange(effectiveDate, since)) continue;

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const qty = parseQty(line.qty);
      addPurchase(map, sku, acct, qty, "invoice");
    }
  }

  const historyKeys = await redis.keys("orderHistory:*");
  const histories = await Promise.all(
    historyKeys.map(async (key) => ({
      accountNo: key.replace(/^orderHistory:/, "").toUpperCase(),
      entries: (await redis.get<OrderHistoryEntry[]>(key)) || [],
    }))
  );

  for (const { accountNo: keyAccountNo, entries } of histories) {
    for (const entry of entries) {
      const entryAccountNo = String(entry.accountNo || keyAccountNo).trim().toUpperCase();
      if (!entryAccountNo) continue;

      const entryDate = parseDate(entry.createdAt);
      if (!inRange(entryDate, since)) continue;

      for (const item of entry.items || []) {
        const sku = cleanSku(item.sku);
        const qty = parseQty(item.qty);
        addPurchase(map, sku, entryAccountNo, qty, "order");
      }
    }
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
      importCount: imports.length,
      orderAccountCount: histories.length,
      days: since ? days : null,
      limit,
    },
  };
}
