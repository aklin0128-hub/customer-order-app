import catalogData from "@/data/catalog_sku_master_extracted.json";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export type CatalogProduct = {
  sku: string;
  name?: string;
  brand?: string;
  category?: string;
  status?: string;
};

export type SaleEvent = {
  accountNo: string;
  sku: string;
  qty: number;
  revenue: number;
  date: Date;
  source: "invoice" | "order";
};

type OrderHistoryEntry = {
  accountNo?: string;
  createdAt?: string;
  items?: { sku?: string; qty?: string | number }[];
};

export function cleanSku(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function parseQty(value: unknown) {
  const num = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function parseDate(value: unknown) {
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

export function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}

export function addUtcDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function sinceFromDays(days: number) {
  if (!Number.isFinite(days) || days <= 0) return null;
  return addUtcDays(startOfUtcDay(new Date()), -days + 1);
}

export function dateInRange(date: Date | null, start: Date | null, end: Date | null) {
  if (!date) return false;
  const t = date.getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function loadInvoiceImports() {
  return (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
}

export async function buildCatalogMap(skus?: string[]) {
  const wanted = skus?.length
    ? new Set(skus.map((s) => cleanSku(s)).filter(Boolean))
    : null;
  const map = new Map<string, CatalogProduct>();

  for (const item of catalogData as CatalogProduct[]) {
    const sku = cleanSku(item.sku);
    if (!sku || (wanted && !wanted.has(sku))) continue;
    map.set(sku, { ...item, sku });
  }

  const keys = wanted
    ? Array.from(wanted).map((sku) => `product:${sku}`)
    : await redis.keys("product:*");
  const redisItems = await Promise.all(keys.map((key) => redis.get<CatalogProduct>(key)));

  for (const item of redisItems) {
    const sku = cleanSku(item?.sku);
    if (!sku || (wanted && !wanted.has(sku))) continue;
    map.set(sku, { ...(map.get(sku) || { sku }), ...item, sku });
  }

  return map;
}

export async function collectSaleEvents(options?: {
  since?: Date | null;
  until?: Date | null;
  invoicesOnly?: boolean;
}): Promise<SaleEvent[]> {
  const events: SaleEvent[] = [];
  const since = options?.since ?? null;
  const until = options?.until ?? null;

  const imports = await loadInvoiceImports();
  for (const record of imports) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!dateInRange(effectiveDate, since, until)) continue;

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const qty = parseQty(line.qty);
      if (!sku || qty <= 0) continue;

      const unitPrice =
        typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
          ? line.unitPrice
          : 0;

      events.push({
        accountNo: acct,
        sku,
        qty,
        revenue: unitPrice > 0 ? qty * unitPrice : 0,
        date: effectiveDate!,
        source: "invoice",
      });
    }
  }

  if (options?.invoicesOnly) return events;

  const historyKeys = await redis.keys("orderHistory:*");
  const histories = await Promise.all(
    historyKeys.map(async (key) => ({
      accountNo: key.replace(/^orderHistory:/, "").toUpperCase(),
      entries: (await redis.get<OrderHistoryEntry[]>(key)) || [],
    }))
  );

  for (const { accountNo: keyAccountNo, entries } of histories) {
    for (const entry of entries) {
      const acct = String(entry.accountNo || keyAccountNo).trim().toUpperCase();
      if (!acct) continue;

      const entryDate = parseDate(entry.createdAt);
      if (!dateInRange(entryDate, since, until)) continue;

      for (const item of entry.items || []) {
        const sku = cleanSku(item.sku);
        const qty = parseQty(item.qty);
        if (!sku || qty <= 0) continue;

        events.push({
          accountNo: acct,
          sku,
          qty,
          revenue: 0,
          date: entryDate!,
          source: "order",
        });
      }
    }
  }

  return events;
}
