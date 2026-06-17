import { cleanSku, formatDate, loadInvoiceImports, parseDate } from "@/lib/analyticsCommon";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";

export type InvoiceLatestPriceRow = {
  account: string;
  sku: string;
  price: number;
  /** Invoice date from the customer's invoice (as printed/parsed), ISO YYYY-MM-DD when parseable. */
  invoiceDate: string;
};

type LatestEntry = {
  price: number;
  invoiceDateMs: number;
  invoiceDateLabel: string;
  uploadedMs: number;
  invoiceNo: string;
};

function priceForLine(line: InvoiceImportRecord["lines"][number]) {
  if (typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice) && line.unitPrice > 0) {
    return line.unitPrice;
  }
  return null;
}

function invoiceDateFromRecord(record: InvoiceImportRecord): { ms: number; label: string } | null {
  const parsed = parseDate(record.invoiceDate);
  if (!parsed) return null;
  const raw = String(record.invoiceDate || "").trim();
  return {
    ms: parsed.getTime(),
    label: raw || formatDate(parsed),
  };
}

function isNewerInvoice(
  next: { invoiceDateMs: number; uploadedMs: number; invoiceNo: string },
  prev: LatestEntry
) {
  if (next.invoiceDateMs > prev.invoiceDateMs) return true;
  if (next.invoiceDateMs < prev.invoiceDateMs) return false;
  if (next.uploadedMs > prev.uploadedMs) return true;
  if (next.uploadedMs < prev.uploadedMs) return false;
  return next.invoiceNo.localeCompare(prev.invoiceNo) > 0;
}

/**
 * Latest unit price per account + SKU using each import's **invoice date** (not upload time).
 * Imports without a parsed invoice date are skipped.
 */
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

    const invoiceDate = invoiceDateFromRecord(record);
    if (!invoiceDate) continue;

    const { ms: invoiceDateMs, label: invoiceDateLabel } = invoiceDate;
    if (sinceMs != null && invoiceDateMs < sinceMs) continue;

    const uploadedMs = parseDate(record.uploadedAt)?.getTime() ?? 0;
    const invoiceNo = String(record.invoiceNo || record.id || "").trim().toUpperCase();

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const price = priceForLine(line);
      if (!sku || price === null) continue;

      const key = `${account}|${sku}`;
      const prev = latest.get(key);
      const candidate = { invoiceDateMs, uploadedMs, invoiceNo };

      if (!prev || isNewerInvoice(candidate, prev)) {
        latest.set(key, {
          price,
          invoiceDateMs,
          invoiceDateLabel,
          uploadedMs,
          invoiceNo,
        });
      }
    }
  }

  return Array.from(latest.entries())
    .map(([key, row]) => {
      const [account, sku] = key.split("|");
      const parsed = parseDate(row.invoiceDateLabel);
      return {
        account,
        sku,
        price: Math.round(row.price * 100) / 100,
        invoiceDate: parsed ? formatDate(parsed) : row.invoiceDateLabel,
      };
    })
    .sort(
      (a, b) =>
        a.account.localeCompare(b.account) ||
        a.sku.localeCompare(b.sku) ||
        a.invoiceDate.localeCompare(b.invoiceDate)
    );
}

export async function getInvoiceLatestPrices(options?: {
  since?: Date | null;
  accountNo?: string;
}): Promise<InvoiceLatestPriceRow[]> {
  const imports = await loadInvoiceImports();
  return buildLatestInvoicePricesFromImports(imports, options);
}

export function invoiceLatestPricesToCsv(rows: InvoiceLatestPriceRow[]): string {
  const header = ["Account", "SKU", "Price"];
  const body = rows.map((row) => [row.account, row.sku, row.price.toFixed(2)]);
  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
