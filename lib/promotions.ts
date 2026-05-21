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

  const keys = wantedSkus
    ? Array.from(wantedSkus).map((sku) => `product:${sku}`)
    : await redis.keys("product:*");
  const redisItems = await Promise.all(keys.map((key) => redis.get<PromotionProduct>(key)));

  for (const item of redisItems) {
    if (!item?.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...(map.get(sku) || {}), ...item, sku });
  }

  return map;
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
