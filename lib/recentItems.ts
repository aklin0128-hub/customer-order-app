import { redis } from "@/lib/redis";

type RecentEntry = { sku: string; qty: string; lastOrderedAt: string };

/** Merge SKUs into recentItems for recommendations (customer order page). */
export async function mergeRecentItems(accountNo: string, items: { sku: string; qty: string }[]) {
  const key = `recentItems:${accountNo}`;
  const current = (await redis.get<RecentEntry[]>(key)) || [];
  const map = new Map<string, RecentEntry>();

  for (const item of current) {
    const sku = String(item?.sku || "").trim().toUpperCase();
    if (sku) map.set(sku, item);
  }

  for (const item of items) {
    const sku = String(item?.sku || "").trim().toUpperCase();
    if (!sku) continue;

    map.set(sku, {
      sku,
      qty: String(item?.qty || "1").trim(),
      lastOrderedAt: new Date().toISOString(),
    });
  }

  const next = Array.from(map.values())
    .sort((a, b) =>
      String(b.lastOrderedAt || "").localeCompare(String(a.lastOrderedAt || ""))
    )
    .slice(0, 30);

  await redis.set(key, next);
}
