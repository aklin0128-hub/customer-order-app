import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const CLEARANCE_KEY = "clearance:list";

export type ClearanceStatus = "active" | "scheduled" | "expired" | "sold_out";

export type ClearanceRecord = {
  sku: string;
  note?: string;
  expiryDate: string;
  clearancePrice: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  updatedAt?: string;
};

export type ClearanceProduct = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  imageUrl?: string;
  limitedQty?: string;
  palletSize?: string;
  category?: string;
  clearanceNote?: string;
  clearancePrice?: string;
  expiryDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  startDate?: string;
  clearanceStatus?: ClearanceStatus;
  daysUntilExpiry?: number | null;
};

function parseDateOnly(value?: string) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parsePositiveInt(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(String(value).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return Math.floor(num);
}

export function daysUntilExpiry(expiryDate?: string, now = new Date()) {
  const end = expiryDate ? parseDateOnly(expiryDate) : null;
  if (!end) return null;
  const today = parseDateOnly(todayDateOnly())!;
  const diff = Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diff;
}

export function normalizeClearanceRecord(entry: unknown): ClearanceRecord | null {
  if (!entry || typeof entry !== "object") return null;

  const raw = entry as Record<string, unknown>;
  const sku = String(raw.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return null;

  const expiryDate = String(raw.expiryDate || "").trim();
  const clearancePrice = String(raw.clearancePrice || "").trim();
  if (!expiryDate || !clearancePrice) return null;

  const startDate = String(raw.startDate || "").trim() || undefined;
  const saleEndDate = String(raw.saleEndDate || "").trim() || undefined;
  const clearanceQty = parsePositiveInt(raw.clearanceQty);
  const soldQty = parsePositiveInt(raw.soldQty) ?? 0;

  return {
    sku,
    note: String(raw.note || "").trim() || undefined,
    expiryDate,
    clearancePrice,
    startDate,
    saleEndDate,
    clearanceQty,
    soldQty,
    updatedAt: String(raw.updatedAt || "").trim() || undefined,
  };
}

export function getClearanceRemainingQty(record: ClearanceRecord): number | null {
  if (!record.clearanceQty || record.clearanceQty <= 0) return null;
  const remaining = record.clearanceQty - (record.soldQty || 0);
  return Math.max(0, remaining);
}

export function getClearanceStatus(record: ClearanceRecord, now = new Date()): ClearanceStatus {
  const remaining = getClearanceRemainingQty(record);
  if (remaining !== null && remaining <= 0) return "sold_out";

  const today = parseDateOnly(todayDateOnly())!;
  const start = record.startDate ? parseDateOnly(record.startDate) : null;
  const expiry = parseDateOnly(record.expiryDate);
  const saleEnd = record.saleEndDate ? parseDateOnly(record.saleEndDate) : null;

  if (start && today < start) return "scheduled";
  if (expiry && today > expiry) return "expired";
  if (saleEnd && today > saleEnd) return "expired";

  return "active";
}

export function isClearanceVisibleToCustomers(record: ClearanceRecord, now = new Date()) {
  return getClearanceStatus(record, now) === "active";
}

export async function getClearanceRecords(): Promise<ClearanceRecord[]> {
  const raw = await redis.get<unknown[]>(CLEARANCE_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: ClearanceRecord[] = [];

  for (const entry of raw) {
    const record = normalizeClearanceRecord(entry);
    if (!record || seen.has(record.sku)) continue;
    seen.add(record.sku);
    list.push(record);
  }

  return list;
}

export async function saveClearanceRecords(records: ClearanceRecord[]) {
  await redis.set(CLEARANCE_KEY, records);
}

async function buildCatalogMap(skus?: string[]) {
  const map = new Map<string, ClearanceProduct>();
  const wantedSkus = skus?.length
    ? new Set(skus.map((sku) => String(sku || "").trim().toUpperCase()).filter(Boolean))
    : null;

  for (const item of catalogData as ClearanceProduct[]) {
    if (!item.sku) continue;
    const sku = String(item.sku).toUpperCase();
    if (wantedSkus && !wantedSkus.has(sku)) continue;
    map.set(sku, { ...item, sku });
  }

  const keys = wantedSkus
    ? Array.from(wantedSkus).map((sku) => `product:${sku}`)
    : await redis.keys("product:*");
  const redisItems = await Promise.all(keys.map((key) => redis.get<ClearanceProduct>(key)));

  for (const item of redisItems) {
    if (!item?.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...(map.get(sku) || {}), ...item, sku });
  }

  return map;
}

function recordToProduct(record: ClearanceRecord, product: ClearanceProduct): ClearanceProduct {
  const remainingQty = getClearanceRemainingQty(record);

  return {
    ...product,
    clearanceNote: record.note || "Sell as is",
    clearancePrice: record.clearancePrice,
    expiryDate: record.expiryDate,
    saleEndDate: record.saleEndDate,
    clearanceQty: record.clearanceQty,
    soldQty: record.soldQty || 0,
    remainingQty,
    startDate: record.startDate,
    clearanceStatus: getClearanceStatus(record),
    daysUntilExpiry: daysUntilExpiry(record.expiryDate),
  };
}

export async function getClearanceProducts(options?: {
  activeOnly?: boolean;
  records?: ClearanceRecord[];
}): Promise<ClearanceProduct[]> {
  const records = options?.records || (await getClearanceRecords());
  if (records.length === 0) return [];

  const map = await buildCatalogMap(records.map((record) => record.sku));
  const products: ClearanceProduct[] = [];

  for (const record of records) {
    if (options?.activeOnly && !isClearanceVisibleToCustomers(record)) continue;

    const product = map.get(record.sku);
    if (!product) continue;

    products.push(recordToProduct(record, product));
  }

  products.sort((a, b) => {
    const ad = a.daysUntilExpiry ?? 99999;
    const bd = b.daysUntilExpiry ?? 99999;
    return ad - bd || a.sku.localeCompare(b.sku);
  });

  return products;
}

export async function incrementClearanceSold(items: { sku: string; qty: number }[]) {
  if (!items.length) return;

  const records = await getClearanceRecords();
  if (!records.length) return;

  const soldMap = new Map<string, number>();
  for (const item of items) {
    const sku = String(item.sku || "")
      .trim()
      .toUpperCase();
    const qty = Number(item.qty) || 0;
    if (!sku || qty <= 0) continue;
    soldMap.set(sku, (soldMap.get(sku) || 0) + qty);
  }

  let changed = false;
  const next = records.map((record) => {
    const add = soldMap.get(record.sku);
    if (!add || !record.clearanceQty) return record;

    changed = true;
    return {
      ...record,
      soldQty: (record.soldQty || 0) + add,
      updatedAt: record.updatedAt,
    };
  });

  if (changed) await saveClearanceRecords(next);
}

export function validateClearanceInput(input: {
  sku?: string;
  note?: string;
  expiryDate?: string;
  clearancePrice?: string;
  startDate?: string;
  saleEndDate?: string;
  clearanceQty?: unknown;
}) {
  const sku = String(input.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return { error: "Missing SKU." };

  const expiryDate = String(input.expiryDate || "").trim();
  const clearancePrice = String(input.clearancePrice || "").trim();
  const startDate = String(input.startDate || "").trim();
  const saleEndDate = String(input.saleEndDate || "").trim();

  if (!expiryDate || !parseDateOnly(expiryDate)) {
    return { error: "Product expiry date is required (YYYY-MM-DD)." };
  }

  if (!clearancePrice) {
    return { error: "Clearance price is required." };
  }

  if (startDate && !parseDateOnly(startDate)) {
    return { error: "Invalid listing start date. Use YYYY-MM-DD." };
  }

  if (saleEndDate && !parseDateOnly(saleEndDate)) {
    return { error: "Invalid sale end date. Use YYYY-MM-DD." };
  }

  if (startDate && saleEndDate && parseDateOnly(startDate)! > parseDateOnly(saleEndDate)!) {
    return { error: "Sale end date must be on or after listing start date." };
  }

  if (saleEndDate && parseDateOnly(saleEndDate)! > parseDateOnly(expiryDate)!) {
    return { error: "Sale end date cannot be after product expiry date." };
  }

  const clearanceQty = parsePositiveInt(input.clearanceQty);
  const note = String(input.note || "").trim();

  return {
    record: {
      sku,
      note: note || undefined,
      expiryDate,
      clearancePrice,
      startDate: startDate || undefined,
      saleEndDate: saleEndDate || undefined,
      clearanceQty,
    } as Partial<ClearanceRecord>,
  };
}
