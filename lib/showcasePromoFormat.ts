import {
  formatPromoBuyXGetYPackHint,
  formatPromoDetails,
  formatPromotionPriceLabel,
  getPromotionDealHighlight,
} from "@/app/order/catalogUtils";
import { copy } from "@/app/order/orderCopy";
import type { LoginPreviewCard } from "@/lib/loginPreview";

export type Lang = "en" | "zh" | "ko" | "vi";

export function formatShowcasePromoDisplay(
  item: LoginPreviewCard,
  lang: Lang
): { priceLine: string; tierPricesLine?: string; details: string[] } {
  const t = copy[lang];
  const details: string[] = [];
  const highlight = getPromotionDealHighlight(item, t);

  let priceLine = "";
  let tierPricesLine: string | undefined;

  if (highlight.headline && highlight.detail) {
    priceLine = highlight.headline;
    tierPricesLine = highlight.detail;
  } else if (highlight.headline) {
    priceLine = highlight.headline;
  } else if (highlight.simplePrice) {
    priceLine = highlight.simplePrice;
  } else {
    const fallback = formatPromotionPriceLabel(item, t);
    if (fallback) priceLine = fallback;
  }

  // Buy X Get Y can also carry a unit promo price — surface it under the deal line.
  if (highlight.headline && highlight.simplePrice) {
    details.push(highlight.simplePrice);
  }

  const packHint = formatPromoBuyXGetYPackHint(item, t);
  if (packHint) details.push(packHint);

  const meta = formatPromoDetails(item, t);
  if (meta) details.push(meta);

  const note = String(item.promoNote || "").trim();
  if (note) details.push(note);

  return { priceLine, tierPricesLine, details };
}
