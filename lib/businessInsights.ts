import {
  addUtcDays,
  buildCatalogMap,
  cleanSku,
  collectSaleEvents,
  parseDate,
  startOfUtcDay,
} from "@/lib/analyticsCommon";
import { getClearanceRecords, daysUntilExpiry, getClearanceRemainingQty } from "@/lib/clearance";
import { getPromotionRecords, getPromotionStatus } from "@/lib/promotions";
import { redis } from "@/lib/redis";

export type PromoEffectRow = {
  sku: string;
  note?: string;
  status: string;
  qtyRecent28: number;
  qtyPrior28: number;
  changePct: number | null;
};

export type ClearanceUrgentRow = {
  sku: string;
  note?: string;
  expiryDate: string;
  daysUntilExpiry: number | null;
  remainingQty: number | null;
  soldQty: number;
  clearancePrice: string;
};

export type CartFollowUpRow = {
  accountNo: string;
  storeName: string;
  totalCases: number;
  lineCount: number;
  updatedAt: string;
  daysSinceUpdate: number | null;
};

export type RestockLeadRow = {
  accountNo: string;
  storeName: string;
  sku: string;
  productName: string;
  lastPurchaseDate: string;
  daysSincePurchase: number;
  purchaseCount: number;
  avgQtyPerOrder: number;
};

type DraftRecord = {
  accountNo?: string;
  storeName?: string;
  cart?: { sku: string; qty: string }[];
  catalogQtyMap?: Record<string, string>;
  updatedAt?: string;
};

export async function getPromoEffectiveness(limit = 8): Promise<PromoEffectRow[]> {
  const promotions = await getPromotionRecords();
  if (!promotions.length) return [];

  const end = startOfUtcDay(new Date());
  const recentStart = addUtcDays(end, -27);
  const priorStart = addUtcDays(end, -55);
  const priorEnd = addUtcDays(end, -28);

  const events = await collectSaleEvents({ since: priorStart, until: end });
  const promoSkus = new Set(promotions.map((p) => p.sku));

  const recent = new Map<string, number>();
  const prior = new Map<string, number>();

  for (const e of events) {
    if (!promoSkus.has(e.sku)) continue;
    const t = e.date.getTime();
    if (t >= recentStart.getTime()) recent.set(e.sku, (recent.get(e.sku) || 0) + e.qty);
    if (t >= priorStart.getTime() && t <= priorEnd.getTime()) {
      prior.set(e.sku, (prior.get(e.sku) || 0) + e.qty);
    }
  }

  const rows: PromoEffectRow[] = promotions.map((p) => {
    const qtyRecent28 = recent.get(p.sku) || 0;
    const qtyPrior28 = prior.get(p.sku) || 0;
    const changePct =
      qtyPrior28 > 0 ? ((qtyRecent28 - qtyPrior28) / qtyPrior28) * 100 : qtyRecent28 > 0 ? null : null;
    return {
      sku: p.sku,
      note: p.note,
      status: getPromotionStatus(p),
      qtyRecent28,
      qtyPrior28,
      changePct,
    };
  });

  return rows
    .sort((a, b) => b.qtyRecent28 - a.qtyRecent28)
    .slice(0, limit);
}

export async function getClearanceUrgency(limit = 8): Promise<ClearanceUrgentRow[]> {
  const records = await getClearanceRecords();
  const rows: ClearanceUrgentRow[] = records.map((r) => ({
    sku: r.sku,
    note: r.note,
    expiryDate: r.expiryDate,
    daysUntilExpiry: daysUntilExpiry(r.expiryDate),
    remainingQty: getClearanceRemainingQty(r),
    soldQty: r.soldQty || 0,
    clearancePrice: r.clearancePrice,
  }));

  return rows
    .filter((r) => r.daysUntilExpiry === null || r.daysUntilExpiry <= 45)
    .sort((a, b) => {
      const da = a.daysUntilExpiry ?? 9999;
      const db = b.daysUntilExpiry ?? 9999;
      if (da !== db) return da - db;
      return (a.remainingQty ?? 9999) - (b.remainingQty ?? 9999);
    })
    .slice(0, limit);
}

export async function getCartStats() {
  const keys = await redis.keys("draft:*");
  let activeCarts = 0;
  let staleCarts = 0;
  const today = startOfUtcDay(new Date());

  for (const key of keys) {
    const draft = await redis.get<DraftRecord>(key);
    if (!draft) continue;
    const hasItems =
      (Array.isArray(draft.cart) && draft.cart.some((i) => Number(i.qty) > 0)) ||
      Object.values(draft.catalogQtyMap || {}).some((q) => Number(q) > 0);
    if (!hasItems) continue;
    activeCarts += 1;
    const updated = parseDate(draft.updatedAt);
    if (updated) {
      const days = Math.floor((today.getTime() - updated.getTime()) / (24 * 60 * 60 * 1000));
      if (days >= 3) staleCarts += 1;
    }
  }

  return { activeCarts, staleCarts };
}

export async function getCartFollowUps(limit = 8): Promise<CartFollowUpRow[]> {
  const keys = await redis.keys("draft:*");
  const drafts = await Promise.all(keys.map((key) => redis.get<DraftRecord>(key)));
  const today = startOfUtcDay(new Date());

  const rows: CartFollowUpRow[] = [];

  for (const draft of drafts) {
    if (!draft) continue;
    const cart = Array.isArray(draft.cart) ? draft.cart : [];
    const mapItems = Object.entries(draft.catalogQtyMap || {});
    const merged = new Map<string, number>();
    for (const item of cart) {
      const sku = cleanSku(item.sku);
      const q = Number(item.qty) || 0;
      if (sku && q > 0) merged.set(sku, (merged.get(sku) || 0) + q);
    }
    for (const [sku, qty] of mapItems) {
      const s = cleanSku(sku);
      const q = Number(qty) || 0;
      if (s && q > 0) merged.set(s, (merged.get(s) || 0) + q);
    }
    if (!merged.size) continue;

    const totalCases = Array.from(merged.values()).reduce((s, q) => s + q, 0);
    const updated = parseDate(draft.updatedAt);
    const daysSinceUpdate = updated
      ? Math.floor((today.getTime() - updated.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    rows.push({
      accountNo: String(draft.accountNo || "").trim().toUpperCase(),
      storeName: String(draft.storeName || "").trim(),
      totalCases,
      lineCount: merged.size,
      updatedAt: draft.updatedAt || "",
      daysSinceUpdate,
    });
  }

  return rows
    .sort((a, b) => {
      const staleA = a.daysSinceUpdate ?? 0;
      const staleB = b.daysSinceUpdate ?? 0;
      if (staleB !== staleA) return staleB - staleA;
      return b.totalCases - a.totalCases;
    })
    .slice(0, limit);
}

export async function getRestockLeads(limit = 10): Promise<RestockLeadRow[]> {
  const since = addUtcDays(startOfUtcDay(new Date()), -180);
  const cutoff = addUtcDays(startOfUtcDay(new Date()), -42);
  const events = await collectSaleEvents({ since, invoicesOnly: true });

  type SkuAgg = { last: Date; count: number; totalQty: number };
  const byAccount = new Map<string, Map<string, SkuAgg>>();

  for (const e of events) {
    let skus = byAccount.get(e.accountNo);
    if (!skus) {
      skus = new Map();
      byAccount.set(e.accountNo, skus);
    }
    const row = skus.get(e.sku) || { last: e.date, count: 0, totalQty: 0 };
    row.count += 1;
    row.totalQty += e.qty;
    if (e.date > row.last) row.last = e.date;
    skus.set(e.sku, row);
  }

  const leads: RestockLeadRow[] = [];
  const catalog = await buildCatalogMap();

  for (const [accountNo, skus] of byAccount) {
    for (const [sku, agg] of skus) {
      if (agg.count < 2 || agg.last >= cutoff) continue;
      const daysSince = Math.floor(
        (startOfUtcDay(new Date()).getTime() - agg.last.getTime()) / (24 * 60 * 60 * 1000)
      );
      const product = catalog.get(sku);
      leads.push({
        accountNo,
        storeName: "",
        sku,
        productName: product?.name || "",
        lastPurchaseDate: agg.last.toISOString().slice(0, 10),
        daysSincePurchase: daysSince,
        purchaseCount: agg.count,
        avgQtyPerOrder: Math.round(agg.totalQty / agg.count),
      });
    }
  }

  return leads.sort((a, b) => b.purchaseCount - a.purchaseCount).slice(0, limit);
}
