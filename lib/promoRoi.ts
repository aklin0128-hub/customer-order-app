import {
  addUtcDays,
  buildCatalogMap,
  collectSaleEvents,
  startOfUtcDay,
} from "@/lib/analyticsCommon";
import { getPromotionRecords, getPromotionStatus } from "@/lib/promotions";

export type PromoRoiRow = {
  sku: string;
  note?: string;
  status: string;
  brand: string;
  qtyPromo28: number;
  qtyBrandPeers28: number;
  liftVsBrandPct: number | null;
};

export async function getPromoRoi(limit = 20): Promise<PromoRoiRow[]> {
  const promotions = await getPromotionRecords();
  const active = promotions.filter((p) => getPromotionStatus(p) === "active");
  if (!active.length) return [];

  const end = startOfUtcDay(new Date());
  const start = addUtcDays(end, -27);
  const events = await collectSaleEvents({ since: start, until: end });
  const promoSkus = new Set(active.map((p) => p.sku));

  const catalog = await buildCatalogMap();
  const brandBySku = new Map<string, string>();
  for (const p of active) {
    brandBySku.set(p.sku, catalog.get(p.sku)?.brand || "Unknown");
  }

  const qtyBySku = new Map<string, number>();
  for (const e of events) {
    qtyBySku.set(e.sku, (qtyBySku.get(e.sku) || 0) + e.qty);
  }

  const brandPeerQty = new Map<string, number>();
  for (const [sku, qty] of qtyBySku) {
    if (promoSkus.has(sku)) continue;
    const brand = catalog.get(sku)?.brand || "";
    if (!brand) continue;
    brandPeerQty.set(brand, (brandPeerQty.get(brand) || 0) + qty);
  }

  const rows: PromoRoiRow[] = active.map((p) => {
    const brand = brandBySku.get(p.sku) || "Unknown";
    const qtyPromo28 = qtyBySku.get(p.sku) || 0;
    const qtyBrandPeers28 = brandPeerQty.get(brand) || 0;
    const liftVsBrandPct =
      qtyBrandPeers28 > 0 ? ((qtyPromo28 - qtyBrandPeers28) / qtyBrandPeers28) * 100 : null;
    return {
      sku: p.sku,
      note: p.note,
      status: getPromotionStatus(p),
      brand,
      qtyPromo28,
      qtyBrandPeers28,
      liftVsBrandPct,
    };
  });

  return rows.sort((a, b) => b.qtyPromo28 - a.qtyPromo28).slice(0, limit);
}
