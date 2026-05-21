import { redis } from "@/lib/redis";

export const PRODUCT_SKU_INDEX = "index:product:skus";
const PRODUCT_KEY_PREFIX = "product:";
const MGET_CHUNK = 500;

function normalizeSku(sku: string) {
  return String(sku || "").trim().toUpperCase();
}

export function productRedisKey(sku: string) {
  return `${PRODUCT_KEY_PREFIX}${normalizeSku(sku)}`;
}

export async function indexProductSku(sku: string) {
  const normalized = normalizeSku(sku);
  if (!normalized) return;
  await redis.sadd(PRODUCT_SKU_INDEX, normalized);
}

/** One-time rebuild when index is empty (uses KEYS — avoid calling often). */
async function rebuildProductSkuIndex(): Promise<string[]> {
  const keys = await redis.keys(`${PRODUCT_KEY_PREFIX}*`);
  const skus = keys
    .map((key) => String(key).replace(/^product:/i, ""))
    .map(normalizeSku)
    .filter(Boolean);

  for (const sku of skus) {
    await redis.sadd(PRODUCT_SKU_INDEX, sku);
  }

  return [...new Set(skus)].sort();
}

export async function listRedisProductSkus(): Promise<string[]> {
  let skus = (await redis.smembers<string[]>(PRODUCT_SKU_INDEX)) || [];
  skus = skus.map(normalizeSku).filter(Boolean);

  if (!skus.length) {
    skus = await rebuildProductSkuIndex();
  }

  return [...new Set(skus)].sort();
}

async function mgetProducts<T extends { sku?: string }>(keys: string[]): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < keys.length; i += MGET_CHUNK) {
    const chunk = keys.slice(i, i + MGET_CHUNK);
    const rows = (await redis.mget<(T | null)[]>(...chunk)) || [];
    for (const item of rows) {
      if (item?.sku) results.push(item);
    }
  }

  return results;
}

/** Load Redis product overrides. Pass SKUs to fetch only those (2 requests: none if empty). */
export async function loadRedisProducts<T extends { sku?: string }>(
  filterSkus?: Iterable<string>
): Promise<T[]> {
  const wanted = filterSkus
    ? [...new Set([...filterSkus].map(normalizeSku).filter(Boolean))]
    : null;

  if (wanted?.length) {
    return mgetProducts<T>(wanted.map(productRedisKey));
  }

  const skus = await listRedisProductSkus();
  if (!skus.length) return [];

  return mgetProducts<T>(skus.map(productRedisKey));
}

export async function saveRedisProduct<T extends { sku: string }>(product: T) {
  const normalized = normalizeSku(product.sku);
  await redis.set(productRedisKey(normalized), { ...product, sku: normalized });
  await indexProductSku(normalized);
}
