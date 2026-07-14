import { getShowcaseData, type ShowcaseData } from "@/lib/loginPreview";

import PublicShowcaseClient from "../new/PublicShowcaseClient";

export const dynamic = "force-dynamic";

const emptyShowcase: ShowcaseData = {
  promotions: [],
  newItems: [],
  promotionTotal: 0,
  newItemTotal: 0,
};

export default async function PromoShowcasePage() {
  let data = emptyShowcase;
  try {
    data = await getShowcaseData();
  } catch (error) {
    console.error("[/promo] Failed to load showcase data:", error);
  }

  return <PublicShowcaseClient data={data} variant="promo" />;
}
