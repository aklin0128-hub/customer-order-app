import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const PROMOTIONS_KEY = "promotions:list";

export type PromotionRecord = {
  sku: string;
  note?: string;
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
};

export async function getPromotionRecords(): Promise<PromotionRecord[]> {
  const raw = await redis.get<PromotionRecord[]>(PROMOTIONS_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: PromotionRecord[] = [];

  for (const entry of raw) {
    const sku = String(entry?.sku || "")
      .trim()
      .toUpperCase();
    if (!sku || seen.has(sku)) continue;
    seen.add(sku);
    list.push({
      sku,
      note: String(entry?.note || "").trim(),
      updatedAt: entry?.updatedAt || "",
    });
  }

  return list;
}

export async function savePromotionRecords(records: PromotionRecord[]) {
  await redis.set(PROMOTIONS_KEY, records);
}

export async function getPromotionProducts(): Promise<PromotionProduct[]> {
  const records = await getPromotionRecords();
  if (records.length === 0) return [];

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

  const products: PromotionProduct[] = [];

  for (const record of records) {
    const product = map.get(record.sku);
    if (!product) continue;
    products.push({
      ...product,
      promoNote: record.note || "",
    });
  }

  return products;
}
