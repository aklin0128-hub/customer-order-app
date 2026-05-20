import { addUtcDays, collectSaleEvents, startOfUtcDay } from "@/lib/analyticsCommon";

export async function getFrequentSkusNotInCart(
  accountNo: string,
  cartSkus: string[],
  limit = 12
): Promise<{ sku: string; qty90: number }[]> {
  const acct = accountNo.trim().toUpperCase();
  if (!acct) return [];

  const inCart = new Set(cartSkus.map((s) => s.trim().toUpperCase()).filter(Boolean));
  const since = addUtcDays(startOfUtcDay(new Date()), -89);
  const events = await collectSaleEvents({ since, invoicesOnly: true });

  const qtyBySku = new Map<string, number>();
  for (const e of events) {
    if (e.accountNo !== acct) continue;
    qtyBySku.set(e.sku, (qtyBySku.get(e.sku) || 0) + e.qty);
  }

  return Array.from(qtyBySku.entries())
    .filter(([sku]) => !inCart.has(sku))
    .map(([sku, qty90]) => ({ sku, qty90 }))
    .sort((a, b) => b.qty90 - a.qty90)
    .slice(0, limit);
}
