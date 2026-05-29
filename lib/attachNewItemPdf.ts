import { productRedisKey, saveRedisProduct } from "@/lib/productRedisStore";
import { redis } from "@/lib/redis";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export async function attachNewItemPdfToProduct(sku: string, pathname: string) {
  const normalized = String(sku || "").trim().toUpperCase();
  if (!normalized) throw new Error("Missing SKU.");
  if (!pathname) throw new Error("Missing PDF pathname.");

  const pdfUrl = `/api/blob?pathname=${encodeURIComponent(pathname)}`;
  const existing = (await redis.get<Record<string, unknown>>(productRedisKey(normalized))) || {};

  await saveRedisProduct({
    ...existing,
    sku: normalized,
    newItemDescriptionPdfUrl: pdfUrl,
    newItemDescriptionPdfPathname: pathname,
    source: "Redis",
    updatedAt: new Date().toISOString(),
  } as { sku: string });

  bustServerDataCache(SERVER_CACHE.catalog);
  bustServerDataCache(SERVER_CACHE.showcase);

  return pdfUrl;
}
