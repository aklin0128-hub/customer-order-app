import { catalog } from "./catalogState";

import { isCatalogNewItem, isJustAddedItem as isJustAddedCatalogItem } from "@/lib/catalogNewItems";
import { scoreCatalogTextSearch } from "@/lib/catalogTextSearch";
import { isOrderableCatalogStatus, isCustomerVisibleCatalogStatus, isReadyToOrderStatus } from "@/lib/orderableCatalog";
import { formatMoneyPrice, formatPromoTierPricesLine, getApplicablePromoTier } from "@/lib/promoFormat";
import type { PromoPriceTier } from "@/lib/promotions";

import type { CatalogItem, ClearanceItem, PromotionItem } from "./types";

import type { CSSProperties } from "react";

/** Strings used by formatPromoDetails (any language). */
export type PromoCopyStrings = {
  promoDateRange: string;
  promoQtyLimit: string;
  promoRemaining: string;
  promoBuyXGetY: string;
  promoBuyXGetYPackHint: string;
  promoVolumeTiers: string;
  promoPrice: string;
  promoTierQtyWarning: string;
  casesAbbr: string;
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

export function formatPromoBuyXGetY(item: Pick<PromotionItem, "buyQty" | "getQtyFree">, t: Pick<PromoCopyStrings, "promoBuyXGetY">) {
  const buy = item.buyQty;
  const free = item.getQtyFree;
  if (!buy || !free || buy <= 0 || free <= 0) return "";
  return t.promoBuyXGetY.replace("{buy}", String(buy)).replace("{free}", String(free));
}

export function formatPromoVolumeTiersLine(
  item: Pick<PromotionItem, "priceTiers">,
  casesAbbr: string
) {
  if (!item.priceTiers?.length) return "";
  return formatPromoTierPricesLine(item.priceTiers, casesAbbr);
}

export type PromotionDealHighlight = {
  headline?: string;
  detail?: string;
  simplePrice?: string;
};

function formatSimplePromoPriceLabel(
  promoPrice: string | undefined,
  t: Pick<PromoCopyStrings, "promoPrice">
) {
  const simple = String(promoPrice || "").trim();
  if (!simple) return undefined;
  const display = simple.startsWith("$") ? simple : formatMoneyPrice(simple);
  return `${t.promoPrice}: ${display}`;
}

/** BOGO and volume tiers use the amber deal highlight; simple price uses promo price line. */
export function getPromotionDealHighlight(
  item: Pick<PromotionItem, "buyQty" | "getQtyFree" | "priceTiers" | "promoPrice">,
  t: PromoCopyStrings
): PromotionDealHighlight {
  const bogo = formatPromoBuyXGetY(item, t);
  if (bogo) {
    return {
      headline: bogo,
      simplePrice: formatSimplePromoPriceLabel(item.promoPrice, t),
    };
  }

  const tierLine = formatPromoVolumeTiersLine(item, t.casesAbbr);
  if (tierLine) {
    return { headline: t.promoVolumeTiers, detail: tierLine };
  }

  const simplePrice = formatSimplePromoPriceLabel(item.promoPrice, t);
  if (!simplePrice) return {};
  return { simplePrice };
}

export function formatPromotionDealReviewLabel(highlight: PromotionDealHighlight) {
  if (highlight.headline && highlight.detail) {
    return `${highlight.headline}\n${highlight.detail}`;
  }
  if (highlight.headline && highlight.simplePrice) {
    return `${highlight.headline}\n${highlight.simplePrice}`;
  }
  return highlight.headline || highlight.detail || highlight.simplePrice || "";
}

export function formatPromotionPriceLabel(
  item: Pick<PromotionItem, "promoPrice" | "priceTiers">,
  t: Pick<PromoCopyStrings, "promoPrice" | "casesAbbr">
) {
  if (item.priceTiers?.length) {
    const line = formatPromoTierPricesLine(item.priceTiers, t.casesAbbr);
    return line ? `${t.promoPrice}: ${line}` : undefined;
  }
  const simple = String(item.promoPrice || "").trim();
  if (!simple) return undefined;
  const display = simple.startsWith("$") ? simple : formatMoneyPrice(simple);
  return `${t.promoPrice}: ${display}`;
}

export function formatPromoTierQtyWarning(
  sku: string,
  qty: number,
  tiers: PromoPriceTier[],
  t: Pick<PromoCopyStrings, "promoTierQtyWarning" | "casesAbbr">
) {
  if (!tiers.length || qty <= 0) return "";
  const tier = getApplicablePromoTier(qty, tiers);
  if (tier) return "";
  const lowest = [...tiers].sort((a, b) => a.minQty - b.minQty)[0];
  return t.promoTierQtyWarning
    .replace("{sku}", sku)
    .replace("{qty}", String(qty))
    .replace("{min}", String(lowest.minQty))
    .replace("{cs}", t.casesAbbr);
}

export function getPromoBogoPackSize(item: Pick<PromotionItem, "buyQty" | "getQtyFree">) {
  const buy = item.buyQty;
  const free = item.getQtyFree;
  if (!buy || !free || buy <= 0 || free <= 0) return null;
  return buy + free;
}

export function formatPromoBuyXGetYPackHint(item: Pick<PromotionItem, "buyQty" | "getQtyFree">, t: Pick<PromoCopyStrings, "promoBuyXGetYPackHint">) {
  const pack = getPromoBogoPackSize(item);
  if (!pack) return "";
  return t.promoBuyXGetYPackHint.replace("{pack}", String(pack));
}

export type PromoDetailsFields = Pick<
  PromotionItem,
  "startDate" | "endDate" | "promoQty" | "soldQty" | "remainingQty"
>;

export function formatPromoDetails(item: PromoDetailsFields, t: PromoCopyStrings) {
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

/** Only these catalog statuses can be added to an order. */
export function isOrderableItem(item?: CatalogItem | null) {
  return isOrderableCatalogStatus(item?.status);
}

/** Hide Ready-to-Order SKUs from customer catalog browsing. */
export function isCustomerVisibleCatalogItem(item?: CatalogItem | null) {
  return Boolean(item?.sku) && isCustomerVisibleCatalogStatus(item?.status);
}

export function isReadyToOrderItem(item?: CatalogItem | null) {
  return isReadyToOrderStatus(item?.status);
}

/** @deprecated Use isOrderableItem — kept for existing imports. */
export function isNormalItem(item?: CatalogItem | null) {
  return isOrderableItem(item);
}

export function formatOrderNotAvailableMessage(
  sku: string,
  status: string | undefined,
  t: { orderNotAvailable: string; statusWarning: string; unavailableMissingSku?: string }
) {
  const cleanSku = String(sku || "").trim().toUpperCase();
  const display = getDisplayStatus(status) || String(status || "").trim().toUpperCase();

  if (cleanSku && display === "NOT FOUND" && t.unavailableMissingSku) {
    return t.unavailableMissingSku.replace("{sku}", cleanSku);
  }
  if (cleanSku && display) {
    return t.statusWarning.replace("{sku}", cleanSku).replace("{status}", display);
  }
  if (cleanSku) {
    return t.statusWarning.replace("{sku}", cleanSku).replace("{status}", "UNAVAILABLE");
  }
  return t.orderNotAvailable;
}

/** Cart / submit lines that the API will reject (missing catalog row or non-orderable status). */
export function getUnavailableSubmitLines<T extends { sku: string; nhItems?: boolean; qty?: string }>(
  items: T[]
): Array<T & { status: string }> {
  const out: Array<T & { status: string }> = [];
  for (const item of items) {
    const cleanSku = String(item.sku || "").trim().toUpperCase();
    if (!cleanSku) continue;
    const catalogItem = getCatalogItemBySku(cleanSku);
    if (!catalogItem) {
      out.push({ ...item, sku: cleanSku, status: "NOT FOUND" });
      continue;
    }
    if (!isOrderableItem(catalogItem)) {
      out.push({
        ...item,
        sku: cleanSku,
        status: getDisplayStatus(catalogItem.status) || String(catalogItem.status || "UNAVAILABLE").toUpperCase(),
      });
    }
  }
  return out;
}

export function isNewItem(item?: CatalogItem | null) {
  return isCatalogNewItem(item);
}

export function isJustAddedItem(item?: CatalogItem | null) {
  return isJustAddedCatalogItem(item);
}

export function getDisplayStatus(status?: string) {
  const s = String(status || "").trim().toUpperCase();
  if (!s || s === "INV") return "";
  // Never surface Ready-to-Order wording to customers.
  if (isReadyToOrderStatus(s)) return "";
  return s;
}

export function getCatalogItemBySku(sku: string) {
  return catalog.find((item) => item.sku?.toUpperCase() === sku.toUpperCase());
}

/** Digits only — for barcode / UPC scanner input. */
export function normalizeScanDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

/** Pad to 12 digits for UPC-A style comparison (keeps GTIN-14 as last 12 when longer). */
export function normalizeUpcScanCode(value: unknown) {
  let digits = normalizeScanDigits(value);
  if (!digits) return "";
  if (digits.length > 12) digits = digits.slice(-12);
  if (digits.length < 12) digits = digits.padStart(12, "0");
  return digits;
}

function catalogScanCodes(item: Pick<CatalogItem, "upc" | "barcode">) {
  const raw = [item.upc, item.barcode].map((v) => normalizeScanDigits(v)).filter(Boolean);
  const normalized = raw.map((d) => normalizeUpcScanCode(d)).filter(Boolean);
  return [...new Set([...raw, ...normalized])];
}

export function catalogItemMatchesScanCode(
  item: Pick<CatalogItem, "upc" | "barcode">,
  query: string
) {
  const qRaw = normalizeScanDigits(query);
  if (!qRaw) return false;
  const qNorm = normalizeUpcScanCode(qRaw);
  return catalogScanCodes(item).some((code) => code === qRaw || code === qNorm);
}

export function catalogItemScanCodeStartsWith(
  item: Pick<CatalogItem, "upc" | "barcode">,
  query: string
) {
  const qRaw = normalizeScanDigits(query);
  if (!qRaw) return false;
  const qNorm = normalizeUpcScanCode(qRaw);
  return catalogScanCodes(item).some(
    (code) =>
      code.startsWith(qRaw) ||
      qRaw.startsWith(code) ||
      code.startsWith(qNorm) ||
      qNorm.startsWith(code)
  );
}

export function findCatalogItemByScanCode(query: string) {
  const q = query.trim();
  if (!q) return null;
  return catalog.find((item) => catalogItemMatchesScanCode(item, q)) || null;
}

/** Best search string after a barcode scan — SKU when known, else digits / raw text. */
export function catalogSearchQueryFromScan(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return "";
  const matched = findCatalogItemByScanCode(trimmed);
  if (matched?.sku) return matched.sku.toUpperCase();
  const digits = normalizeScanDigits(trimmed);
  if (digits) return digits;
  return trimmed.toUpperCase();
}

/** + / - (and = / _) in SKU search — adjust qty, do not type into the field. */
export function isOrderSearchQtyAdjustKey(key: string) {
  return key === "+" || key === "=" || key === "-" || key === "_";
}

export function resolveQuickSearchTargetItem(
  query: string,
  options: {
    selected: CatalogItem | null;
    matched: CatalogItem[];
  }
): CatalogItem | null {
  if (options.selected) return options.selected;
  const trimmed = query.trim();
  if (!trimmed) return options.matched[0] || null;
  const upper = trimmed.toUpperCase();
  const exact =
    catalog.find((item) => item.sku?.toUpperCase() === upper) || findCatalogItemByScanCode(trimmed);
  return exact || options.matched[0] || null;
}

export function resolveCatalogFilterTargetItem(query: string, filtered: CatalogItem[]): CatalogItem | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const exact =
    catalog.find((item) => item.sku?.toUpperCase() === upper) || findCatalogItemByScanCode(trimmed);
  if (exact) return exact;
  if (filtered.length === 1) return filtered[0] || null;
  return null;
}

function catalogSearchTokens(value: string) {
  return String(value || "")
    .toUpperCase()
    .split(/[^A-Z0-9\u4e00-\u9fff]+/)
    .filter(Boolean);
}

export function scoreCatalogSearchQuery(item: CatalogItem, query: string) {
  const raw = query.trim();
  if (!raw) return -1;

  // UPC / barcode scan matches beat plain text ranks.
  if (catalogItemMatchesScanCode(item, raw)) return 850;
  if (catalogItemScanCodeStartsWith(item, raw)) return 800;

  return scoreCatalogTextSearch(item, raw);
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
