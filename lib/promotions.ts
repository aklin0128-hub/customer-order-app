import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const PROMOTIONS_KEY = "promotions:list";

export type PromotionStatus = "active" | "scheduled" | "expired" | "sold_out";

export type PromotionRecord = {
  sku: string;
  note?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: number;
  soldQty?: number;
  promoPrice?: string;
  updatedAt?: string;
};

export type PromotionProduct = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  imageUrl?: string;
  limitedQty?: string;
  palletSize?: string;
  category?: string;
  promoNote?: string;
  promoPrice?: string;
  promoQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  startDate?: string;
  endDate?: string;
  promoStatus?: PromotionStatus;
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

export function normalizePromotionRecord(entry: unknown): PromotionRecord | null {
  if (!entry || typeof entry !== "object") return null;

  const raw = entry as Record<string, unknown>;
  const sku = String(raw.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return null;

  const startDate = String(raw.startDate || "").trim() || undefined;
  const endDate = String(raw.endDate || "").trim() || undefined;
  const promoQty = parsePositiveInt(raw.promoQty);
  const soldQty = parsePositiveInt(raw.soldQty) ?? 0;
  const promoPrice = String(raw.promoPrice || "").trim() || undefined;

  return {
    sku,
    note: String(raw.note || "").trim() || undefined,
    startDate,
    endDate,
    promoQty,
    soldQty,
    promoPrice,
    updatedAt: String(raw.updatedAt || "").trim() || undefined,
  };
}

export function getPromotionRemainingQty(record: PromotionRecord): number | null {
  if (!record.promoQty || record.promoQty <= 0) return null;
  const remaining = record.promoQty - (record.soldQty || 0);
  return Math.max(0, remaining);
}

export function getPromotionStatus(record: PromotionRecord, now = new Date()): PromotionStatus {
  const remaining = getPromotionRemainingQty(record);
  if (remaining !== null && remaining <= 0) return "sold_out";

  const today = parseDateOnly(todayDateOnly())!;
  const start = record.startDate ? parseDateOnly(record.startDate) : null;
  const end = record.endDate ? parseDateOnly(record.endDate) : null;

  if (start && today < start) return "scheduled";
  if (end && today > end) return "expired";

  return "active";
}

export function isPromotionVisibleToCustomers(record: PromotionRecord, now = new Date()) {
  const status = getPromotionStatus(record, now);
  return status === "active";
}

export async function getPromotionRecords(): Promise<PromotionRecord[]> {
  const raw = await redis.get<unknown[]>(PROMOTIONS_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: PromotionRecord[] = [];

  for (const entry of raw) {
    const record = normalizePromotionRecord(entry);
    if (!record || seen.has(record.sku)) continue;
    seen.add(record.sku);
    list.push(record);
  }

  return list;
}

export async function savePromotionRecords(records: PromotionRecord[]) {
  await redis.set(PROMOTIONS_KEY, records);
}

async function buildCatalogMap() {
  const map = new Map<string, PromotionProduct>();

  for (const item of catalogData as PromotionProduct[]) {
    if (!item.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...item, sku });
  }

  const keys = await redis.keys("product:*");
  for (const key of keys) {
    const item = await redis.get<PromotionProduct>(key);
    if (!item?.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...(map.get(sku) || {}), ...item, sku });
  }

  return map;
}

function recordToProduct(record: PromotionRecord, product: PromotionProduct): PromotionProduct {
  const remainingQty = getPromotionRemainingQty(record);

  return {
    ...product,
    promoNote: record.note || "",
    promoPrice: record.promoPrice || "",
    promoQty: record.promoQty,
    soldQty: record.soldQty || 0,
    remainingQty,
    startDate: record.startDate,
    endDate: record.endDate,
    promoStatus: getPromotionStatus(record),
  };
}

export async function getPromotionProducts(options?: {
  activeOnly?: boolean;
}): Promise<PromotionProduct[]> {
  const records = await getPromotionRecords();
  if (records.length === 0) return [];

  const map = await buildCatalogMap();
  const products: PromotionProduct[] = [];

  for (const record of records) {
    if (options?.activeOnly && !isPromotionVisibleToCustomers(record)) continue;

    const product = map.get(record.sku);
    if (!product) continue;

    products.push(recordToProduct(record, product));
  }

  return products;
}

export async function incrementPromotionSold(
  items: { sku: string; qty: number }[]
) {
  if (!items.length) return;

  const records = await getPromotionRecords();
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
    if (!add || !record.promoQty) return record;

    changed = true;
    return {
      ...record,
      soldQty: (record.soldQty || 0) + add,
      updatedAt: record.updatedAt,
    };
  });

  if (changed) await savePromotionRecords(next);
}

export function validatePromotionInput(input: {
  sku?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: unknown;
  promoPrice?: string;
}) {
  const sku = String(input.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return { error: "Missing SKU." };

  const startDate = String(input.startDate || "").trim();
  const endDate = String(input.endDate || "").trim();

  if (startDate && !parseDateOnly(startDate)) {
    return { error: "Invalid start date. Use YYYY-MM-DD." };
  }

  if (endDate && !parseDateOnly(endDate)) {
    return { error: "Invalid end date. Use YYYY-MM-DD." };
  }

  if (startDate && endDate && parseDateOnly(startDate)! > parseDateOnly(endDate)!) {
    return { error: "End date must be on or after start date." };
  }

  const promoQty = parsePositiveInt(input.promoQty);
  const promoPrice = String(input.promoPrice || "").trim();

  return {
    record: {
      sku,
      note: "",
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      promoQty,
      promoPrice: promoPrice || undefined,
    } as Partial<PromotionRecord>,
  };
}
