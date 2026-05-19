import type { UpsellLine } from "./components/SalesUpsellPanel";
import { formatClearancePriceLabel } from "./components/SalesUpsellPanel";
import { getPromotionDealHighlight } from "./catalogUtils";
import { copy } from "./orderCopy";
import type { ClearanceItem, Lang, PromotionItem } from "./types";

export function buildWeeklyUpsellLines(
  lang: Lang,
  items: PromotionItem[],
  cartSkus: Set<string>,
  t: { promoBadge: string; promoRemaining: string; promoSoldOut: string }
): UpsellLine[] {
  return items
    .filter((item) => {
      const sku = item.sku?.toUpperCase();
      if (!sku || cartSkus.has(sku)) return false;
      if (item.remainingQty === 0) return false;
      return true;
    })
    .map((item) => {
      const highlight = getPromotionDealHighlight(item, copy[lang]);
      return {
      sku: item.sku!.toUpperCase(),
      name: item.name,
      brand: item.brand,
      imageUrl: item.imageUrl,
      priceLabel: highlight.simplePrice,
      dealHeadline: highlight.headline,
      dealDetail: highlight.detail,
      badge: highlight.headline || t.promoBadge,
      remainingLabel:
        item.remainingQty !== null && item.remainingQty !== undefined
          ? `${t.promoRemaining}: ${item.remainingQty}`
          : undefined,
    };
    });
}

export function buildClearanceUpsellLines(
  lang: Lang,
  items: ClearanceItem[],
  cartSkus: Set<string>,
  t: { clearanceBadge: string; clearanceRemaining: string }
): UpsellLine[] {
  return items
    .filter((item) => {
      const sku = item.sku?.toUpperCase();
      if (!sku || cartSkus.has(sku)) return false;
      if (item.remainingQty === 0) return false;
      return true;
    })
    .map((item) => ({
      sku: item.sku!.toUpperCase(),
      name: item.name,
      brand: item.brand,
      imageUrl: item.imageUrl,
      priceLabel: formatClearancePriceLabel(lang, item.clearancePrice),
      badge: t.clearanceBadge,
      remainingLabel:
        item.remainingQty !== null && item.remainingQty !== undefined
          ? `${t.clearanceRemaining}: ${item.remainingQty}`
          : undefined,
    }));
}

export function pickPostSubmitSuggestions(
  promotions: PromotionItem[],
  submittedSkus: Set<string>,
  limit = 3
): PromotionItem[] {
  return promotions
    .filter((item) => {
      const sku = item.sku?.toUpperCase();
      return sku && !submittedSkus.has(sku) && item.remainingQty !== 0;
    })
    .slice(0, limit);
}
