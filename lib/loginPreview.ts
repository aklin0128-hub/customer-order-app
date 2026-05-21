import catalogData from "@/data/catalog_sku_master_extracted.json";
import { getPromotionProducts, type PromotionProduct } from "@/lib/promotions";

export type LoginPreviewCard = {
  sku: string;
  name?: string;
  brand?: string;
  size?: string;
  imageUrl?: string;
  promoPrice?: string;
  promoNote?: string;
};

const PREVIEW_LIMIT = 24;

function productImageUrl(sku: string, imageUrl?: string) {
  const custom = String(imageUrl || "").trim();
  if (custom) return custom;
  return `/product/${sku}.jpg`;
}

function isNewCatalogItem(item: Record<string, unknown>) {
  if (typeof item.isNew === "boolean") return item.isNew;

  const text = [item.name, item.size, item["name_k"]]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[_-]+/g, " ");

  return /(^|\s)NEW(\s|$)/.test(text);
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

async function countAndSampleNewItems(promoSkus: Set<string>) {
  const samples: LoginPreviewCard[] = [];
  let total = 0;

  const consider = (raw: Record<string, unknown>) => {
    const sku = String(raw.sku || "")
      .trim()
      .toUpperCase();
    if (!sku || sku.includes(" ")) return;
    if (!isNewCatalogItem(raw)) return;

    total += 1;
    if (samples.length < PREVIEW_LIMIT) {
      samples.push(catalogToCard(raw));
    }
  };

  for (const item of catalogData as Record<string, unknown>[]) {
    consider(item);
  }

  return { samples, total };
}

export async function getLoginPreviewData() {
  const promotions = await getPromotionProducts({ activeOnly: true });
  const promoSkus = new Set(promotions.map((p) => p.sku.toUpperCase()));
  const { samples: newItems, total: newItemTotal } = await countAndSampleNewItems(promoSkus);

  return {
    promotions: promotions.slice(0, PREVIEW_LIMIT).map(promoToCard),
    newItems,
    promotionTotal: promotions.length,
    newItemTotal,
  };
}
