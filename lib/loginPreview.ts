import { isNewItem } from "@/app/order/catalogUtils";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { getPromotionProducts, type PromotionProduct } from "@/lib/promotions";
import type { CatalogItem } from "@/app/order/types";

export type LoginPreviewCard = {
  sku: string;
  name?: string;
  brand?: string;
  size?: string;
  imageUrl?: string;
  promoPrice?: string;
  promoNote?: string;
};

export type ShowcaseData = {
  promotions: LoginPreviewCard[];
  newItems: LoginPreviewCard[];
  promotionTotal: number;
  newItemTotal: number;
};

function productImageUrl(sku: string, imageUrl?: string) {
  const custom = String(imageUrl || "").trim();
  if (custom) return custom;
  return `/product/${sku}.jpg`;
}

function promoToCard(item: PromotionProduct): LoginPreviewCard {
  const sku = String(item.sku || "")
    .trim()
    .toUpperCase();
  return {
    sku,
    name: item.name,
    brand: item.brand,
    size: item.size,
    imageUrl: productImageUrl(sku, item.imageUrl),
    promoPrice: item.promoPrice,
    promoNote: item.promoNote,
  };
}

function catalogToCard(item: Record<string, unknown>): LoginPreviewCard {
  const sku = String(item.sku || "")
    .trim()
    .toUpperCase();
  return {
    sku,
    name: String(item.name || "").trim() || undefined,
    brand: String(item.brand || "").trim() || undefined,
    size: String(item.size || "").trim() || undefined,
    imageUrl: productImageUrl(sku, String(item.imageUrl || "").trim() || undefined),
  };
}

async function listNewItemCards(cardLimit?: number) {
  const products = await getMergedCatalogProducts();
  const cards: LoginPreviewCard[] = [];

  for (const item of products) {
    if (!isNewItem(item as CatalogItem)) continue;
    cards.push(catalogToCard(item));
  }

  return {
    cards: cardLimit != null ? cards.slice(0, cardLimit) : cards,
    total: cards.length,
  };
}

/** Public showcase and login preview share this loader. */
export async function getShowcaseData(options?: { cardLimit?: number }): Promise<ShowcaseData> {
  const cardLimit = options?.cardLimit;
  const promotions = await getPromotionProducts({ activeOnly: true });
  const promoCards = promotions.map(promoToCard);
  const { cards: newItems, total: newItemTotal } = await listNewItemCards(cardLimit);

  return {
    promotions: cardLimit != null ? promoCards.slice(0, cardLimit) : promoCards,
    newItems,
    promotionTotal: promotions.length,
    newItemTotal,
  };
}

