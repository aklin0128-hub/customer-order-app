import type { PromoPriceTier } from "@/lib/promotions";

export function formatMoneyPrice(price: string) {
  const trimmed = String(price || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

/** e.g. $10.00/280cs */
export function formatPromoTierUnit(price: string, minQty: number, casesSuffix = "cs") {
  const money = formatMoneyPrice(price);
  if (!money || !minQty || minQty <= 0) return "";
  return `${money}/${minQty}${casesSuffix}`;
}

export function sortPromoPriceTiers(tiers: PromoPriceTier[]) {
  return [...tiers].sort((a, b) => b.minQty - a.minQty);
}

export function formatPromoTierPricesLine(tiers: PromoPriceTier[], casesSuffix = "cs") {
  const parts = sortPromoPriceTiers(tiers)
    .map((tier) => formatPromoTierUnit(tier.price, tier.minQty, casesSuffix))
    .filter(Boolean);
  return parts.join(" · ");
}

export function getApplicablePromoTier(qty: number, tiers: PromoPriceTier[]) {
  if (!tiers.length || qty <= 0) return null;
  const sorted = sortPromoPriceTiers(tiers);
  return sorted.find((tier) => qty >= tier.minQty) ?? null;
}
