export type Lang = "en" | "zh" | "ko" | "vi";

/** Top-level order shop tabs. Quick order (`search`) stays available but hidden. */
export type OrderMode = "catalog" | "promotion" | "clearance" | "newItems" | "seasonal" | "search";

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
  categories?: string[];
  isNew?: boolean;
  /** Admin: show JUST ADDED badge and pin to top of lists */
  justAdded?: boolean;
  /** ISO time when SKU first appeared in catalog (import) */
  importedAt?: string;
  /** ISO time when admin first marked SKU as new */
  newSince?: string;
  /** Admin-set publish date (YYYY-MM-DD) for /new/ display and sort */
  newPublishedDate?: string;
  /** Admin-set expected arrival (YYYY-MM-DD) for coming-soon new items */
  newItemComingDate?: string;
  /** Short blurb for /new/ showcase modal */
  newItemDescription?: string;
  /** PDF served via /api/blob (Admin upload) */
  newItemDescriptionPdfUrl?: string;
  /** /new/ showcase: DRY, FROZEN, or FRESH */
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
  /** /new/ showcase only — optional list price (display) */
  newItemListPrice?: string;
  /** Admin: show Coming Soon tag on /new/ and order New items (not orderable yet) */
  newItemOutOfStock?: boolean;
  newItemComingSoon?: boolean;
  /** Admin flag: show OUT OF STOCK stamp and block ordering on all order tabs. */
  outOfStock?: boolean;
  /** On-hand cases from today_update.xlsx INV column. */
  inventory?: number;
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
  /** True when line was added from clearance tab (NH_ITEMS email tag). */
  nhItems?: boolean;
};

export type OrderHistoryItem = {
  orderRef: string;
  createdAt: string;
  itemCount: number;
  totalCases: number;
  note?: string;
  items: CartItem[];
};
