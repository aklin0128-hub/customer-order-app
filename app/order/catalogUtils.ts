import { catalog } from "./catalogState";

import type { CatalogItem, ClearanceItem, PromotionItem } from "./types";

import type { CSSProperties } from "react";

/** Strings used by formatPromoDetails (any language). */
export type PromoCopyStrings = {
  promoDateRange: string;
  promoQtyLimit: string;
  promoRemaining: string;
};

export type ClearanceCopyStrings = {
  clearanceExpiry: string;
  clearanceQtyLimit: string;
  clearanceRemaining: string;
  clearanceDaysLeft: string;
};

export function formatBrandLabel(brand: string) {
  if (!brand) return brand;
  return brand
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPromoDetails(item: PromotionItem, t: PromoCopyStrings) {
  const parts: string[] = [];

  if (item.startDate || item.endDate) {
    parts.push(`${t.promoDateRange}: ${item.startDate || "—"} → ${item.endDate || "—"}`);
  }

  if (item.promoQty && item.promoQty > 0) {
    const left =
      item.remainingQty ?? Math.max(0, item.promoQty - (item.soldQty || 0));
    parts.push(
      `${t.promoQtyLimit}: ${item.soldQty || 0}/${item.promoQty} (${t.promoRemaining} ${left})`
    );
  }

  return parts.join(" · ");
}

export function formatClearanceDetails(item: ClearanceItem, t: ClearanceCopyStrings) {
  const parts: string[] = [];

  if (item.expiryDate) {
    const days = item.daysUntilExpiry;
    const daysText =
      days === null || days === undefined
        ? ""
        : days <= 0
          ? ""
          : ` (${t.clearanceDaysLeft.replace("{days}", String(days))})`;
    parts.push(`${t.clearanceExpiry}: ${item.expiryDate}${daysText}`);
  }

  if (item.clearanceQty && item.clearanceQty > 0) {
    const left =
      item.remainingQty ?? Math.max(0, item.clearanceQty - (item.soldQty || 0));
    parts.push(
      `${t.clearanceQtyLimit}: ${item.soldQty || 0}/${item.clearanceQty} (${t.clearanceRemaining} ${left})`
    );
  }

  return parts.join(" · ");
}

export function getImageUrl(sku?: string) {
  if (!sku) return "";
  return `/product/${sku}.jpg`;
}

export function isNormalItem(item?: CatalogItem | null) {
  const s = String(item?.status || "").trim().toUpperCase();
  return (
    s === "NORMAL" ||
    s === "NORMAL_NOBR" ||
    s === "NORMAL_NBR" ||
    s === "TBD" ||
    s === "NEW" ||
    s === "LIMITED"
  );
}

export function isNewItem(item?: CatalogItem | null) {
  if (typeof item?.isNew === "boolean") return item.isNew;

  const text = [
    item?.name,
    item?.size,
    (item as CatalogItem & { name_k?: string })?.name_k,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[_-]+/g, " ");

  return /(^|\s)NEW(\s|$)/.test(text);
}

export function getDisplayStatus(status?: string) {
  const s = String(status || "").trim().toUpperCase();
  if (!s || s === "INV") return "";
  return s;
}

export function getCatalogItemBySku(sku: string) {
  return catalog.find((item) => item.sku?.toUpperCase() === sku.toUpperCase());
}

export function generateOrderRef(accountNo: string) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${accountNo}-${mm}${dd}-${hh}${min}`;
}

export function getStatusBadgeStyle(status?: string): CSSProperties {
  const value = String(status || "").trim().toUpperCase();

  if (
    value === "NORMAL" ||
    value === "NORMAL_NOBR" ||
    value === "NORMAL_NBR" ||
    value === "TBD"
  ) {
    return { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" };
  }

  if (value === "LIMITED") {
    return { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
  }

  return { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" };
}
