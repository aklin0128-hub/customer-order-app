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
): { priceLine: string; details: string[] } {
  const t = copy[lang];
  const details: string[] = [];
  const highlight = getPromotionDealHighlight(item, t);

  let priceLine = "";

  if (highlight.headline && highlight.detail) {
    priceLine = highlight.headline;
    details.push(highlight.detail);
  } else if (highlight.headline) {
    priceLine = highlight.headline;
  } else if (highlight.simplePrice) {
    priceLine = highlight.simplePrice;
  } else {
    const fallback = formatPromotionPriceLabel(item, t);
    if (fallback) priceLine = fallback;
  }

  const packHint = formatPromoBuyXGetYPackHint(item, t);
  if (packHint) details.push(packHint);

  const meta = formatPromoDetails(item, t);
  if (meta) details.push(meta);

  const note = String(item.promoNote || "").trim();
  if (note) details.push(note);

  return { priceLine, details };
}
