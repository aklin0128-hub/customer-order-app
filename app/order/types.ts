export type Lang = "en" | "zh" | "ko" | "vi";
export type OrderMode = "search" | "catalog" | "promotion" | "clearance" | "newItems";

export type CatalogItem = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  barcode?: string;
  upc?: string;
  size?: string;
  limitedQty?: string;
  palletSize?: string;
  imageUrl?: string;
  category?: string;
  isNew?: boolean;
  /** Admin: show JUST ADDED badge and pin to top of lists */
  justAdded?: boolean;
  /** ISO time when SKU first appeared in catalog (import) */
  importedAt?: string;
  /** Short blurb for /new/ showcase modal */
  newItemDescription?: string;
  /** PDF served via /api/blob (Admin upload) */
  newItemDescriptionPdfUrl?: string;
  /** /new/ showcase: DRY, FROZEN, or FRESH */
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
};

export type PromoPriceTier = {
  minQty: number;
  price: string;
};

export type PromotionItem = CatalogItem & {
  promoNote?: string;
  promoPrice?: string;
  promoQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  startDate?: string;
  endDate?: string;
  buyQty?: number;
  getQtyFree?: number;
  priceTiers?: PromoPriceTier[];
};

export type ClearanceItem = CatalogItem & {
  clearanceNote?: string;
  clearancePrice?: string;
  expiryDate?: string;
  saleEndDate?: string;
  clearanceQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  startDate?: string;
  daysUntilExpiry?: number | null;
};

export type CartItem = {
  sku: string;
  qty: string;
};

export type OrderHistoryItem = {
  accountNo: string;
  storeName: string;
  orderRef: string;
  items: CartItem[];
  note?: string;
  phone?: string;
  createdAt: string;
};
