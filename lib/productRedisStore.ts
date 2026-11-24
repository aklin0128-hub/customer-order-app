import { redisSaddChunks, redisMgetChunks } from "@/lib/redisBatch";
import { redis } from "@/lib/redis";

export const PRODUCT_SKU_INDEX = "index:product:skus";
export const PRODUCT_OVERRIDES_SNAPSHOT = "products:overrides";
const PRODUCT_KEY_PREFIX = "product:";

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

export async function invalidateProductOverridesSnapshot() {
  await redis.del(PRODUCT_OVERRIDES_SNAPSHOT);
}

/** One-time rebuild when index is empty (uses KEYS — avoid calling often). */
async function rebuildProductSkuIndex(): Promise<string[]> {
  const keys = await redis.keys(`${PRODUCT_KEY_PREFIX}*`);
  const skus = [
    ...new Set(
      keys
        .map((key) => String(key).replace(/^product:/i, ""))
        .map(normalizeSku)
        .filter(Boolean)
    ),
  ].sort();

  await redisSaddChunks(PRODUCT_SKU_INDEX, skus);
  return skus;
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
  const rows = await redisMgetChunks<T>(keys);
  return rows.filter((item): item is T => Boolean(item?.sku));
}

/** Load Redis product overrides. Full catalog uses one snapshot GET after the first fill. */
export async function loadRedisProducts<T extends { sku?: string }>(
  filterSkus?: Iterable<string>
): Promise<T[]> {
  const wanted = filterSkus
    ? [...new Set([...filterSkus].map(normalizeSku).filter(Boolean))]
    : null;

  if (wanted?.length) {
    return mgetProducts<T>(wanted.map(productRedisKey));
  }

  const snapshot = await redis.get<T[]>(PRODUCT_OVERRIDES_SNAPSHOT);
  if (Array.isArray(snapshot)) {
    return snapshot.filter((item): item is T => Boolean(item?.sku));
  }

  const skus = await listRedisProductSkus();
  if (!skus.length) {
    await redis.set(PRODUCT_OVERRIDES_SNAPSHOT, []);
    return [];
  }

  const products = await mgetProducts<T>(skus.map(productRedisKey));
  await redis.set(PRODUCT_OVERRIDES_SNAPSHOT, products);
  return products;
}

export async function saveRedisProduct<T extends { sku: string }>(
  product: T,
  options?: { skipSnapshotInvalidate?: boolean }
) {
  const normalized = normalizeSku(product.sku);
  await redis.set(productRedisKey(normalized), { ...product, sku: normalized });
  await indexProductSku(normalized);
  if (!options?.skipSnapshotInvalidate) {
    await invalidateProductOverridesSnapshot();
  }
}
