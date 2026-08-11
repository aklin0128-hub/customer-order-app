import { loadRedisProducts } from "@/lib/productRedisStore";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";
export const PROMOTIONS_KEY = "promotions:list";

export type PromotionStatus = "active" | "scheduled" | "expired" | "sold_out" | "ended";

export type PromoPriceTier = {
  minQty: number;
  price: string;
};

export type PromotionDealType = "none" | "bogo" | "tiered";

export type PromotionRecord = {
  sku: string;
  note?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: number;
  soldQty?: number;
  /** Single promo price when deal type is none. */
  promoPrice?: string;
  /** Buy this many cases to qualify (e.g. 2 in Buy 2 Get 1 free). */
  buyQty?: number;
  /** Free cases when buyQty is met (e.g. 1 in Buy 2 Get 1 free). */
  getQtyFree?: number;
  /** Up to 3 min-qty price breaks (mutually exclusive with bogo). */
  priceTiers?: PromoPriceTier[];
  /** Admin manually ended — hides from store even before end date. */
  ended?: boolean;
  /** Admin pin — show first in weekly picks / promotion tab */
  pinned?: boolean;
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
  buyQty?: number;
  getQtyFree?: number;
  priceTiers?: PromoPriceTier[];
  pinned?: boolean;
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

function normalizePriceTiers(raw: unknown): PromoPriceTier[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const tiers: PromoPriceTier[] = [];
  for (const entry of raw.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const minQty = parsePositiveInt(row.minQty);
    const price = String(row.price || "").trim();
    if (!minQty || !price) continue;
    tiers.push({ minQty, price });
  }

  return tiers.length > 0 ? tiers : undefined;
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
  const buyQty = parsePositiveInt(raw.buyQty);
  const getQtyFree = parsePositiveInt(raw.getQtyFree);
  const priceTiers = normalizePriceTiers(raw.priceTiers);

  const ended =
    raw.ended === true ||
    String(raw.ended || "")
      .trim()
      .toLowerCase() === "true";

  const pinned =
    raw.pinned === true ||
    String(raw.pinned || "")
      .trim()
      .toLowerCase() === "true";

  const record: PromotionRecord = {
    sku,
    note: String(raw.note || "").trim() || undefined,
    startDate,
    endDate,
    promoQty,
    soldQty,
    promoPrice,
    buyQty,
    getQtyFree,
    priceTiers,
    ended: ended || undefined,
    pinned: pinned || undefined,
    updatedAt: String(raw.updatedAt || "").trim() || undefined,
  };

  return sanitizePromotionDealFields(record);
}

export function hasBuyXGetYDeal(record: Pick<PromotionRecord, "buyQty" | "getQtyFree">) {
  return Boolean(record.buyQty && record.getQtyFree && record.buyQty > 0 && record.getQtyFree > 0);
}

export function hasTieredPromoPricing(record: Pick<PromotionRecord, "priceTiers">) {
  return Boolean(record.priceTiers && record.priceTiers.length > 0);
}

export function getPromotionDealType(record: PromotionRecord): PromotionDealType {
  if (hasBuyXGetYDeal(record)) return "bogo";
  if (hasTieredPromoPricing(record)) return "tiered";
  return "none";
}

/** Keep bogo vs tiered mutually exclusive; prefer bogo if both present in bad data. */
export function sanitizePromotionDealFields(record: PromotionRecord): PromotionRecord {
  if (hasBuyXGetYDeal(record)) {
    return { ...record, priceTiers: undefined };
  }
  if (hasTieredPromoPricing(record)) {
    return { ...record, buyQty: undefined, getQtyFree: undefined, promoPrice: undefined };
  }
  return { ...record, buyQty: undefined, getQtyFree: undefined, priceTiers: undefined };
}

export function getPromotionRemainingQty(record: PromotionRecord): number | null {
  if (!record.promoQty || record.promoQty <= 0) return null;
  const remaining = record.promoQty - (record.soldQty || 0);
  return Math.max(0, remaining);
}

/** Parse invoice/upload dates (YYYY-MM-DD or M/D/YYYY) into the same noon-local day as promo windows. */
export function parsePromotionSaleDate(value?: string | null): Date | null {
  const text = String(value || "").trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return parseDateOnly(text.slice(0, 10));
  }

  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const y = Number(us[3].length === 2 ? `20${us[3]}` : us[3]);
    const m = String(Number(us[1])).padStart(2, "0");
    const d = String(Number(us[2])).padStart(2, "0");
    if (!Number.isFinite(y)) return null;
    return parseDateOnly(`${y}-${m}-${d}`);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return parseDateOnly(`${y}-${m}-${d}`);
}

/**
 * Inclusive calendar window using promo startDate/endDate.
 * Missing start or end = open on that side. Unknown sale date = not in window.
 */
export function isSaleDateWithinPromotionWindow(
  record: Pick<PromotionRecord, "startDate" | "endDate">,
  saleDate?: string | Date | null
): boolean {
  const sale =
    saleDate instanceof Date
      ? parsePromotionSaleDate(saleDate.toISOString())
      : parsePromotionSaleDate(saleDate);
  if (!sale) return false;

  const start = record.startDate ? parseDateOnly(record.startDate) : null;
  const end = record.endDate ? parseDateOnly(record.endDate) : null;
  if (start && sale < start) return false;
  if (end && sale > end) return false;
  return true;
}

export function getPromotionStatus(record: PromotionRecord, now = new Date()): PromotionStatus {
  if (record.ended) return "ended";

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

export function isPinnedPromotion(record?: Pick<PromotionRecord, "pinned"> | null) {
  return Boolean(record?.pinned);
}

/** Pinned promos first; preserve saved order within each group. */
export function sortPromotionRecords<T extends PromotionRecord>(records: T[]): T[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const aPin = isPinnedPromotion(a.record) ? 1 : 0;
      const bPin = isPinnedPromotion(b.record) ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin;
      return a.index - b.index;
    })
    .map(({ record }) => record);
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

  return sortPromotionRecords(list);
}

export async function savePromotionRecords(records: PromotionRecord[]) {
  await redis.set(PROMOTIONS_KEY, records);
}

async function buildCatalogMap(skus?: string[]) {
  const map = new Map<string, PromotionProduct>();
  const wantedSkus = skus?.length
    ? new Set(skus.map((sku) => String(sku || "").trim().toUpperCase()).filter(Boolean))
    : null;

  for (const item of catalogData as PromotionProduct[]) {
    if (!item.sku) continue;
    const sku = String(item.sku).toUpperCase();
    if (wantedSkus && !wantedSkus.has(sku)) continue;
    map.set(sku, { ...item, sku });
  }

  const redisItems = await loadRedisProducts<PromotionProduct>(
    wantedSkus ? Array.from(wantedSkus) : undefined
  );

  for (const item of redisItems) {
    if (!item?.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...(map.get(sku) || {}), ...item, sku });
  }

  return map;
}

/** Resolve one SKU from catalog JSON + Redis overrides (for admin forms). */
export async function lookupPromotionCatalogProduct(
  sku: string
): Promise<PromotionProduct | null> {
  const clean = String(sku || "").trim().toUpperCase();
  if (!clean) return null;
  const map = await buildCatalogMap([clean]);
  return map.get(clean) ?? null;
}

function recordToProduct(record: PromotionRecord, product: PromotionProduct): PromotionProduct {
  const remainingQty = getPromotionRemainingQty(record);
  const clean = sanitizePromotionDealFields(record);

  return {
    ...product,
    promoNote: record.note || "",
    promoPrice: clean.promoPrice || "",
    promoQty: clean.promoQty,
    soldQty: clean.soldQty || 0,
    remainingQty,
    startDate: clean.startDate,
    endDate: clean.endDate,
    buyQty: clean.buyQty,
    getQtyFree: clean.getQtyFree,
    priceTiers: clean.priceTiers,
    promoStatus: getPromotionStatus(clean),
    pinned: clean.pinned,
  };
}

export async function getPromotionProducts(options?: {
  activeOnly?: boolean;
  records?: PromotionRecord[];
}): Promise<PromotionProduct[]> {
  const records = options?.records || await getPromotionRecords();
  if (records.length === 0) return [];

  const map = await buildCatalogMap(records.map((record) => record.sku));
  const products: PromotionProduct[] = [];

  for (const record of records) {
    if (options?.activeOnly && !isPromotionVisibleToCustomers(record)) continue;

    const product = map.get(record.sku);
    if (!product) continue;

    products.push(recordToProduct(record, product));
  }

  return products;
}

/** Pure soldQty bump used by order submit and invoice upload. */
export function applyPromotionSoldIncrements(
  records: PromotionRecord[],
  items: { sku: string; qty: number }[],
  options?: {
    /** When set with onlyWithinValidWindow, only count sales inside promo start/end. */
    saleDate?: string | Date | null;
    onlyWithinValidWindow?: boolean;
  }
): { next: PromotionRecord[]; changed: boolean } {
  if (!records.length || !items.length) {
    return { next: records, changed: false };
  }

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
    if (options?.onlyWithinValidWindow && !isSaleDateWithinPromotionWindow(record, options.saleDate)) {
      return record;
    }

    changed = true;
    return {
      ...record,
      soldQty: (record.soldQty || 0) + add,
      updatedAt: record.updatedAt,
    };
  });

  return { next, changed };
}

export async function incrementPromotionSold(
  items: { sku: string; qty: number }[]
) {
  if (!items.length) return;

  const records = await getPromotionRecords();
  if (!records.length) return;

  const { next, changed } = applyPromotionSoldIncrements(records, items);
  if (changed) await savePromotionRecords(next);
}

/**
 * Count invoice lines toward limited promo qty when the invoice date
 * (or upload time fallback) falls inside the promo's valid date window.
 */
export async function incrementPromotionSoldFromInvoice(
  items: { sku: string; qty: number }[],
  saleDate?: string | null
) {
  if (!items.length) return;

  const records = await getPromotionRecords();
  if (!records.length) return;

  const { next, changed } = applyPromotionSoldIncrements(records, items, {
    saleDate: saleDate || todayDateOnly(),
    onlyWithinValidWindow: true,
  });
  if (changed) await savePromotionRecords(next);
}

export function validatePromotionInput(input: {
  sku?: string;
  startDate?: string;
  endDate?: string;
  promoQty?: unknown;
  promoPrice?: string;
  buyQty?: unknown;
  getQtyFree?: unknown;
  priceTiers?: unknown;
  dealType?: string;
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
  const buyQty = parsePositiveInt(input.buyQty);
  const getQtyFree = parsePositiveInt(input.getQtyFree);
  const priceTiers = normalizePriceTiers(input.priceTiers);
  const dealType = String(input.dealType || "").trim() as PromotionDealType | "";

  const hasBuy = buyQty !== undefined;
  const hasFree = getQtyFree !== undefined;
  if (hasBuy !== hasFree) {
    return { error: "Buy X Get Y free requires both buy qty and free qty, or leave both empty." };
  }

  const wantsBogo = dealType === "bogo" || (hasBuy && hasFree);
  const wantsTiered = dealType === "tiered" || Boolean(priceTiers?.length);

  if (wantsBogo && wantsTiered) {
    return { error: "Choose either Buy X Get Y free or volume pricing tiers — not both." };
  }

  if (dealType === "bogo" && (!buyQty || !getQtyFree)) {
    return { error: "Buy X Get Y free requires buy qty and free qty." };
  }

  if (dealType === "tiered" && !priceTiers?.length) {
    return { error: "Add at least one volume price tier (min qty + price)." };
  }

  if (wantsTiered && priceTiers) {
    const minQtySet = new Set(priceTiers.map((t) => t.minQty));
    if (minQtySet.size !== priceTiers.length) {
      return { error: "Each volume tier must have a different minimum case qty." };
    }
  }

  const draft: PromotionRecord = sanitizePromotionDealFields({
    sku,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    promoQty,
    promoPrice: wantsBogo || wantsTiered ? undefined : promoPrice || undefined,
    buyQty: wantsBogo ? buyQty : undefined,
    getQtyFree: wantsBogo ? getQtyFree : undefined,
    priceTiers: wantsTiered ? priceTiers : undefined,
  });

  return {
    record: {
      ...draft,
      note: "",
    } as Partial<PromotionRecord>,
  };
}

/** Parse pasted SKU lists — newlines, commas, tabs, semicolons. */
export function parsePromotionSkuList(text: string) {
  const seen = new Set<string>();
  const skus: string[] = [];

  for (const token of String(text || "").split(/[\s,;|\t\r\n]+/)) {
    const sku = token.trim().toUpperCase();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    skus.push(sku);
  }

  return skus;
}

export type BulkImportPromotionResult = {
  added: string[];
  skippedExisting: string[];
  missingCatalog: string[];
};

/** Create bare promotion rows for many SKUs — edit pricing/dates later in admin. */
export async function bulkImportPromotionSkus(skus: string[]): Promise<BulkImportPromotionResult> {
  const parsed = parsePromotionSkuList(skus.join("\n"));
  if (parsed.length === 0) {
    return { added: [], skippedExisting: [], missingCatalog: [] };
  }

  const current = await getPromotionRecords();
  const existing = new Set(current.map((record) => record.sku));
  const catalogMap = await buildCatalogMap(parsed);
  const now = new Date().toISOString();

  const added: string[] = [];
  const skippedExisting: string[] = [];
  const missingCatalog: string[] = [];
  const newRecords: PromotionRecord[] = [];

  for (const sku of parsed) {
    if (existing.has(sku)) {
      skippedExisting.push(sku);
      continue;
    }

    existing.add(sku);
    newRecords.push({ sku, updatedAt: now });
    added.push(sku);
    if (!catalogMap.has(sku)) missingCatalog.push(sku);
  }

  if (newRecords.length > 0) {
    await savePromotionRecords([...newRecords, ...current]);
  }

  return { added, skippedExisting, missingCatalog };
}
