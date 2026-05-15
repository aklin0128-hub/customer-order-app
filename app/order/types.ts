export type Lang = "en" | "zh" | "ko" | "vi";
export type OrderMode = "search" | "catalog" | "promotion";

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
};

export type PromotionItem = CatalogItem & {
  promoNote?: string;
  promoPrice?: string;
  promoQty?: number;
  soldQty?: number;
  remainingQty?: number | null;
  startDate?: string;
  endDate?: string;
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
