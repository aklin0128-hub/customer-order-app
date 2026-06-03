import { cleanSku, loadInvoiceImports, parseDate } from "@/lib/analyticsCommon";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";

export type InvoiceLatestPriceRow = {
  account: string;
  sku: string;
  price: number;
};

type LatestEntry = {
  price: number;
  effectiveMs: number;
  uploadedMs: number;
};

function priceForLine(line: InvoiceImportRecord["lines"][number]) {
  if (typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice) && line.unitPrice > 0) {
    return line.unitPrice;
  }
  return null;
}

/** Latest unit price per account + SKU from uploaded invoice imports. */
export function buildLatestInvoicePricesFromImports(
  imports: InvoiceImportRecord[],
  options?: { since?: Date | null; accountNo?: string }
): InvoiceLatestPriceRow[] {
  const sinceMs = options?.since?.getTime() ?? null;
  const accountFilter = String(options?.accountNo || "").trim().toUpperCase();
  const latest = new Map<string, LatestEntry>();

  for (const record of imports) {
    const account = String(record.accountNo || "").trim().toUpperCase();
    if (!account) continue;
    if (accountFilter && account !== accountFilter) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!effectiveDate) continue;
    const effectiveMs = effectiveDate.getTime();
    if (sinceMs != null && effectiveMs < sinceMs) continue;

    const uploadedMs = parseDate(record.uploadedAt)?.getTime() ?? effectiveMs;

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const price = priceForLine(line);
      if (!sku || price === null) continue;

      const key = `${account}|${sku}`;
      const prev = latest.get(key);
      const isNewer =
        !prev ||
        effectiveMs > prev.effectiveMs ||
        (effectiveMs === prev.effectiveMs && uploadedMs >= prev.uploadedMs);

      if (isNewer) {
        latest.set(key, { price, effectiveMs, uploadedMs });
      }
    }
  }

  return Array.from(latest.entries())
    .map(([key, row]) => {
      const [account, sku] = key.split("|");
      return {
        account,
        sku,
        price: Math.round(row.price * 100) / 100,
      };
    })
    .sort((a, b) => a.account.localeCompare(b.account) || a.sku.localeCompare(b.sku));
}

export async function getInvoiceLatestPrices(options?: {
  since?: Date | null;
  accountNo?: string;
}): Promise<InvoiceLatestPriceRow[]> {
  const imports = await loadInvoiceImports();
  return buildLatestInvoicePricesFromImports(imports, options);
}

export function invoiceLatestPricesToCsv(rows: InvoiceLatestPriceRow[]): string {
  const header = ["account", "sku", "price"];
  const body = rows.map((row) => [row.account, row.sku, row.price]);
  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
