import type { SkuOrderHistoryEntry } from "@/lib/skuOrderHistory";

export type SkuInvoicePricePoint = {
  orderRef: string;
  invoiceDate: string;
  uploadedAt: string;
  unitPrice: number;
};

function normalizeInvoiceNo(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^\w\-]+/g, "_");
}

/** Match history orderRef like INV-12345 → invoice number key. */
export function invoiceNoFromOrderRef(orderRef: string): string {
  const raw = String(orderRef || "").trim();
  const match = /^INV-(.+)$/i.exec(raw);
  return match ? normalizeInvoiceNo(match[1] || "") : "";
}

export function orderRefFromInvoiceNo(invoiceNo: string | null | undefined): string {
  const safe = normalizeInvoiceNo(String(invoiceNo || ""));
  return safe ? `INV-${safe}` : "";
}

export function skuInvoicePriceDayKey(isoOrDate: string): string {
  const raw = String(isoOrDate || "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw.length === 10 ? `${raw}T12:00:00.000Z` : raw);
  if (!Number.isFinite(parsed)) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    return m?.[1] || "";
  }
  return new Date(parsed).toISOString().slice(0, 10);
}

/**
 * Attach a unit price to each history row: stored price → INV orderRef → same calendar day → nearest earlier invoice.
 * Client-safe (no Node/fs imports).
 */
export function attachUnitPricesToSkuHistory(
  entries: SkuOrderHistoryEntry[],
  points: SkuInvoicePricePoint[]
): SkuOrderHistoryEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const byOrderRef = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const point of points) {
    const ref = String(point.orderRef || "").trim().toUpperCase();
    if (ref && !byOrderRef.has(ref)) byOrderRef.set(ref, point.unitPrice);
    const day = skuInvoicePriceDayKey(point.invoiceDate || point.uploadedAt);
    if (day && !byDay.has(day)) byDay.set(day, point.unitPrice);
  }

  const sortedPoints = [...points].sort((a, b) => {
    const aDay = skuInvoicePriceDayKey(a.invoiceDate || a.uploadedAt);
    const bDay = skuInvoicePriceDayKey(b.invoiceDate || b.uploadedAt);
    return aDay.localeCompare(bDay);
  });

  return entries.map((entry) => {
    if (typeof entry.unitPrice === "number" && Number.isFinite(entry.unitPrice) && entry.unitPrice > 0) {
      return entry;
    }

    const ref = String(entry.orderRef || "").trim().toUpperCase();
    if (ref && byOrderRef.has(ref)) {
      return { ...entry, unitPrice: byOrderRef.get(ref)! };
    }

    const entryDay = skuInvoicePriceDayKey(entry.createdAt);
    if (entryDay && byDay.has(entryDay)) {
      return { ...entry, unitPrice: byDay.get(entryDay)! };
    }

    if (entryDay) {
      let nearest: number | null = null;
      for (const point of sortedPoints) {
        const pointDay = skuInvoicePriceDayKey(point.invoiceDate || point.uploadedAt);
        if (!pointDay || pointDay > entryDay) break;
        nearest = point.unitPrice;
      }
      if (nearest != null) return { ...entry, unitPrice: nearest };
    }

    return entry;
  });
}
