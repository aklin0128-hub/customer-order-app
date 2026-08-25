import { loadRedisProducts } from "@/lib/productRedisStore";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const VEGE_PEARS_KEY = "vegePears:list";

export type VegePearsRecord = {
  sku: string;
  note?: string;
  sortOrder?: number;
  updatedAt?: string;
};

export type VegePearsProduct = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  imageUrl?: string;
  limitedQty?: string;
  palletSize?: string;
  category?: string;
  upc?: string;
  barcode?: string;
  outOfStock?: boolean;
  vegePearsNote?: string;
  sortOrder?: number;
};

export function normalizeVegePearsRecord(entry: unknown): VegePearsRecord | null {
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  const sku = String(raw.sku || "")
    .trim()
    .toUpperCase();
  if (!sku) return null;

  const sortRaw = Number(raw.sortOrder);
  const sortOrder = Number.isFinite(sortRaw) ? Math.floor(sortRaw) : undefined;

  return {
    sku,
    note: String(raw.note || "").trim() || undefined,
    sortOrder,
    updatedAt: String(raw.updatedAt || "").trim() || undefined,
  };
}

export function sortVegePearsRecords<T extends VegePearsRecord>(records: T[]): T[] {
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => {
      const aOrder = a.record.sortOrder;
      const bOrder = b.record.sortOrder;
      const aHas = typeof aOrder === "number";
      const bHas = typeof bOrder === "number";
      if (aHas && bHas && aOrder !== bOrder) return aOrder! - bOrder!;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ record }) => record);
}

export async function getVegePearsRecords(): Promise<VegePearsRecord[]> {
  const raw = await redis.get<unknown[]>(VEGE_PEARS_KEY);
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const list: VegePearsRecord[] = [];
  for (const entry of raw) {
    const record = normalizeVegePearsRecord(entry);
    if (!record || seen.has(record.sku)) continue;
    seen.add(record.sku);
    list.push(record);
  }
  return sortVegePearsRecords(list);
}

export async function saveVegePearsRecords(records: VegePearsRecord[]) {
  await redis.set(VEGE_PEARS_KEY, sortVegePearsRecords(records));
}

async function buildCatalogMap(skus?: string[]) {
  const map = new Map<string, VegePearsProduct>();
  const wanted = skus?.length
    ? new Set(skus.map((sku) => String(sku || "").trim().toUpperCase()).filter(Boolean))
    : null;

  for (const item of catalogData as VegePearsProduct[]) {
    if (!item.sku) continue;
    const sku = String(item.sku).toUpperCase();
    if (wanted && !wanted.has(sku)) continue;
    map.set(sku, { ...item, sku });
  }

  const redisItems = await loadRedisProducts<VegePearsProduct>(
    wanted ? Array.from(wanted) : undefined
  );
  for (const item of redisItems) {
    if (!item?.sku) continue;
    const sku = String(item.sku).toUpperCase();
    map.set(sku, { ...(map.get(sku) || {}), ...item, sku });
  }

  return map;
}

export async function lookupVegePearsCatalogProduct(sku: string): Promise<VegePearsProduct | null> {
  const clean = String(sku || "").trim().toUpperCase();
  if (!clean) return null;
  const map = await buildCatalogMap([clean]);
  return map.get(clean) ?? null;
}

export async function getVegePearsProducts(opts?: {
  records?: VegePearsRecord[];
}): Promise<VegePearsProduct[]> {
  const records = opts?.records || (await getVegePearsRecords());
  if (records.length === 0) return [];

  const map = await buildCatalogMap(records.map((r) => r.sku));
  const products: VegePearsProduct[] = [];

  for (const record of records) {
    const base = map.get(record.sku) || { sku: record.sku };
    products.push({
      ...base,
      sku: record.sku,
      vegePearsNote: record.note || "",
      sortOrder: record.sortOrder,
    });
  }

  return products;
}

/** Parse pasted SKU lists — newlines, commas, tabs, semicolons. */
export function parseVegePearsSkuList(text: string) {
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
