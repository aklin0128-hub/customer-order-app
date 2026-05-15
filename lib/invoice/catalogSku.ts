import catalogMaster from "@/data/catalog_sku_master_extracted.json";
import { redis } from "@/lib/redis";

const staticSkus = new Set(
  (catalogMaster as { sku?: string }[])
    .map((x) => String(x?.sku || "").trim().toUpperCase())
    .filter(Boolean)
);

export async function skuIsInCatalog(sku: string): Promise<boolean> {
  const u = String(sku || "").trim().toUpperCase();
  if (!u) return false;
  if (staticSkus.has(u)) return true;
  const hit = await redis.get<unknown>(`product:${u}`);
  return Boolean(hit);
}
