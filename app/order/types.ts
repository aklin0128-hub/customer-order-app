export type Lang = "en" | "zh" | "ko" | "vi";
export type OrderMode = "search" | "catalog" | "promotion" | "clearance";

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
