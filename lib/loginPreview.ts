import { isNewItem } from "@/app/order/catalogUtils";
import { compareCatalogByNewestImport, parseNewPublishedDate } from "@/lib/catalogNewItems";
import { formatNewItemListPriceDisplay, normalizeNewItemListPrice } from "@/lib/newItemListPrice";
import { resolveNewItemStorageLabel } from "@/lib/newItemStorageLabel";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { readCatalogInventory } from "@/lib/catalogStock";
import { getPromotionProducts, type PromotionProduct } from "@/lib/promotions";
import { cachedServerData, SERVER_CACHE } from "@/lib/serverDataCache";
import type { CatalogItem } from "@/app/order/types";

import type { PromoPriceTier } from "@/lib/promotions";

export type LoginPreviewCard = {
  sku: string;
  name?: string;
  brand?: string;
  size?: string;
  imageUrl?: string;
  promoPrice?: string;
  promoNote?: string;
  buyQty?: number;
  getQtyFree?: number;
  priceTiers?: PromoPriceTier[];
  startDate?: string;
  endDate?: string;
  promoQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  justAdded?: boolean;
  newItemDescription?: string;
  newItemDescriptionPdfUrl?: string;
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
  newPublishedDate?: string;
  /** /new/ showcase only */
  newItemListPrice?: string;
  inventory?: number;
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
    buyQty: item.buyQty,
    getQtyFree: item.getQtyFree,
    priceTiers: item.priceTiers,
    startDate: item.startDate,
    endDate: item.endDate,
    promoQty: item.promoQty,
    soldQty: item.soldQty,
    remainingQty: item.remainingQty,
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
    justAdded: Boolean(item.justAdded),
    newItemDescription: String(item.newItemDescription || "").trim() || undefined,
    newItemDescriptionPdfUrl: String(item.newItemDescriptionPdfUrl || "").trim() || undefined,
    newItemStorageLabel: resolveNewItemStorageLabel(item),
    newPublishedDate: parseNewPublishedDate(item.newPublishedDate),
    newItemListPrice: formatNewItemListPriceDisplay(
      normalizeNewItemListPrice(item.newItemListPrice)
    ) || undefined,
    inventory: readCatalogInventory(item.inventory) ?? undefined,
  };
}

async function listNewItemCards(cardLimit?: number) {
  const products = await getMergedCatalogProducts();
  const cards: LoginPreviewCard[] = [];

  for (const item of products) {
    if (!isNewItem(item as CatalogItem)) continue;
    cards.push(catalogToCard(item));
  }

  cards.sort(compareCatalogByNewestImport);

  return {
    cards: cardLimit != null ? cards.slice(0, cardLimit) : cards,
    total: cards.length,
  };
}

/** Public showcase and login preview share this loader. */
export async function getShowcaseDataUncached(options?: { cardLimit?: number }): Promise<ShowcaseData> {
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

export async function getShowcaseData(options?: { cardLimit?: number }): Promise<ShowcaseData> {
  const key = options?.cardLimit != null ? `limit:${options.cardLimit}` : "full";
  return cachedServerData(SERVER_CACHE.showcase, key, () => getShowcaseDataUncached(options));
}

