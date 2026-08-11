import { cleanSku } from "@/lib/analyticsPure";
import { resolveInvoiceCaseUnitPrice } from "@/lib/invoice/invoiceCaseUnitPrice";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { invoiceRecencyKey } from "@/lib/invoice/invoiceRecency";
import {
  orderRefFromInvoiceNo,
  skuInvoicePriceDayKey,
  type SkuInvoicePricePoint,
} from "@/lib/skuInvoicePriceHistoryPure";

export type { SkuInvoicePricePoint } from "@/lib/skuInvoicePriceHistoryPure";
export {
  attachUnitPricesToSkuHistory,
  invoiceNoFromOrderRef,
  orderRefFromInvoiceNo,
} from "@/lib/skuInvoicePriceHistoryPure";

function priceForLine(line: InvoiceImportRecord["lines"][number]): number | null {
  const price = resolveInvoiceCaseUnitPrice({
    qty: line.qty,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  });
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? Math.round(price * 100) / 100
    : null;
}

/** Invoice unit-price points for one account + SKU (newest first). Server-only. */
export function buildSkuInvoicePricePointsFromImports(
  imports: InvoiceImportRecord[],
  accountNo: string,
  sku: string
): SkuInvoicePricePoint[] {
  const acct = String(accountNo || "").trim().toUpperCase();
  const wantSku = cleanSku(sku) || String(sku || "").trim().toUpperCase();
  if (!acct || !wantSku) return [];

  const points: SkuInvoicePricePoint[] = [];

  for (const record of imports) {
    const recordAcct = String(record.accountNo || "").trim().toUpperCase();
    if (recordAcct !== acct) continue;

    let unitPrice: number | null = null;
    for (const line of record.lines || []) {
      const lineSku = cleanSku(line.sku) || String(line.sku || "").trim().toUpperCase();
      if (lineSku !== wantSku) continue;
      unitPrice = priceForLine(line);
      if (unitPrice != null) break;
    }
    if (unitPrice == null) continue;

    const orderRef =
      orderRefFromInvoiceNo(record.invoiceNo) ||
      (record.id ? `INV-${String(record.id).slice(0, 8)}` : "");
    const recency = invoiceRecencyKey(record);
    const invoiceDate =
      String(record.invoiceDate || "").trim() ||
      (recency ? new Date(recency.effectiveDateMs).toISOString().slice(0, 10) : "");

    points.push({
      orderRef,
      invoiceDate,
      uploadedAt: String(record.uploadedAt || "").trim(),
      unitPrice,
    });
  }

  return points.sort((a, b) => {
    const aDay = skuInvoicePriceDayKey(a.invoiceDate || a.uploadedAt);
    const bDay = skuInvoicePriceDayKey(b.invoiceDate || b.uploadedAt);
    return bDay.localeCompare(aDay) || b.uploadedAt.localeCompare(a.uploadedAt);
  });
}
