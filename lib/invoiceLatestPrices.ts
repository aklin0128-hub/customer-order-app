import { cleanSku, formatDate, loadInvoiceImports, parseDate } from "@/lib/analyticsCommon";
import { resolveInvoiceCaseUnitPrice } from "@/lib/invoice/invoiceCaseUnitPrice";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";
import {
  invoiceDateLabel,
  invoiceRecencyKey,
  sortImportsByRecency,
} from "@/lib/invoice/invoiceRecency";

export type InvoiceLatestPriceRow = {
  account: string;
  sku: string;
  price: number;
  /** Invoice date from the customer's invoice (as printed/parsed), ISO YYYY-MM-DD when parseable. */
  invoiceDate: string;
};

type LatestEntry = {
  price: number;
  invoiceDateLabel: string;
};

function priceForLine(line: InvoiceImportRecord["lines"][number]) {
  const price = resolveInvoiceCaseUnitPrice({
    qty: line.qty,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  });
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * Latest case unit price per account + SKU from the newest invoice import that contains the SKU.
 * Recency uses invoice date when parsed, otherwise upload time.
 */
export function buildLatestInvoicePricesFromImports(
  imports: InvoiceImportRecord[],
  options?: { since?: Date | null; accountNo?: string }
): InvoiceLatestPriceRow[] {
  const sinceMs = options?.since?.getTime() ?? null;
  const accountFilter = String(options?.accountNo || "").trim().toUpperCase();
  const latest = new Map<string, LatestEntry>();

  for (const record of sortImportsByRecency(imports)) {
    const account = String(record.accountNo || "").trim().toUpperCase();
    if (!account) continue;
    if (accountFilter && account !== accountFilter) continue;

    const recency = invoiceRecencyKey(record);
    if (!recency) continue;
    if (sinceMs != null && recency.effectiveDateMs < sinceMs) continue;

    const effective = new Date(recency.effectiveDateMs);
    const dateLabel = invoiceDateLabel(record, effective);

    for (const line of record.lines || []) {
      const sku = cleanSku(line.sku);
      const price = priceForLine(line);
      if (!sku || price === null) continue;

      const key = `${account}|${sku}`;
      if (latest.has(key)) continue;

      latest.set(key, {
        price,
        invoiceDateLabel: dateLabel,
      });
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

export const INVOICE_LATEST_PRICES_KEY = "invoicePrices:latest";

export function filterLatestPriceRows(
  rows: InvoiceLatestPriceRow[],
  options?: { since?: Date | null; accountNo?: string }
): InvoiceLatestPriceRow[] {
  const accountFilter = String(options?.accountNo || "").trim().toUpperCase();
  const sinceMs = options?.since?.getTime() ?? null;
  if (!accountFilter && sinceMs == null) return rows;

  return rows.filter((row) => {
    if (accountFilter && row.account !== accountFilter) return false;
    if (sinceMs != null) {
      const parsed = parseDate(row.invoiceDate);
      if (!parsed || parsed.getTime() < sinceMs) return false;
    }
    return true;
  });
}

export async function refreshInvoiceLatestPricesCache(imports: InvoiceImportRecord[]) {
  const rows = buildLatestInvoicePricesFromImports(imports);
  await redis.set(INVOICE_LATEST_PRICES_KEY, rows);
}

async function loadInvoiceLatestPriceRows(): Promise<InvoiceLatestPriceRow[]> {
  const cached = await redis.get<InvoiceLatestPriceRow[]>(INVOICE_LATEST_PRICES_KEY);
  if (Array.isArray(cached)) return cached;

  const imports = await loadInvoiceImports();
  const rows = buildLatestInvoicePricesFromImports(imports);
  await redis.set(INVOICE_LATEST_PRICES_KEY, rows);
  return rows;
}

export async function getInvoiceLatestPrices(options?: {
  since?: Date | null;
  accountNo?: string;
}): Promise<InvoiceLatestPriceRow[]> {
  const rows = await loadInvoiceLatestPriceRows();
  return filterLatestPriceRows(rows, options);
}

export function invoiceLatestPricesToCsv(rows: InvoiceLatestPriceRow[]): string {
  const header = ["account", "sku", "price", "lastPriceDate"];
  const body = rows.map((row) => [row.account, row.sku, row.price.toFixed(2), row.invoiceDate || ""]);
  return [header, ...body]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
