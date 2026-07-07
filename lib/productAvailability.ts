import {
  isComingSoonNewItem,
  isNewItemOutOfStockStamp,
  type NewItemStampFields,
} from "@/lib/comingSoonBadge";

export type ProductAvailabilityFields = NewItemStampFields & {
  outOfStock?: boolean;
};

/** Out-of-stock stamp for any catalog product (regular or new-item). */
export function isProductOutOfStockStamp(item?: ProductAvailabilityFields | null) {
  if (Boolean(item?.outOfStock)) return true;
  return isNewItemOutOfStockStamp(item);
}

/** Block qty stepper / quick add for stamped unavailable products. */
export function isProductOrderingBlocked(item?: ProductAvailabilityFields | null) {
  if (Boolean(item?.outOfStock)) return true;
  if (isComingSoonNewItem(item)) return true;
  return isNewItemOutOfStockStamp(item);
}
