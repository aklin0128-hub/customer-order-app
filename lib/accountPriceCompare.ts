import { invoiceCompareAccountKey, invoiceCompareAccountsMatch } from "@/lib/invoiceCompareCsv";
import type { InvoiceLatestPriceRow } from "@/lib/invoiceLatestPrices";

export const ACCOUNT_PRICE_COMPARE_MAX = 7;

export type AccountPriceCompareCatalogItem = {
  sku?: string;
  name?: string;
  size?: string;
  brand?: string;
};

export type AccountPriceCompareCell = {
  price: number | null;
  invoiceDate: string;
};

export type AccountPriceCompareRow = {
  sku: string;
  itemDesc: string;
  cells: AccountPriceCompareCell[];
};

export type AccountPriceCompareReport = {
  accounts: string[];
  skuCount: number;
  rows: AccountPriceCompareRow[];
};

/** Keep unique Customer #s, first-seen order, max 7. */
export function parseAccountPriceCompareList(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const acct = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!acct) continue;
    const key = invoiceCompareAccountKey(acct);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(acct);
    if (out.length >= ACCOUNT_PRICE_COMPARE_MAX) break;
  }
  return out;
}

export function accountPriceItemDesc(item?: AccountPriceCompareCatalogItem | null) {
  const name = String(item?.name || "").trim();
  const size = String(item?.size || "").trim();
  return [name, size].filter(Boolean).join(" ");
}

export function formatAccountPriceCell(price: number | null) {
  if (price == null || !Number.isFinite(price)) return "-";
  return `$${price.toFixed(2)}`;
}

function pricesForAccount(rows: InvoiceLatestPriceRow[], account: string) {
  const map = new Map<string, AccountPriceCompareCell>();
  for (const row of rows) {
    if (!invoiceCompareAccountsMatch(row.account, account)) continue;
    const sku = String(row.sku || "").trim().toUpperCase();
    if (!sku || map.has(sku)) continue;
    const price = Number(row.price);
    map.set(sku, {
      price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null,
      invoiceDate: String(row.invoiceDate || ""),
    });
  }
  return map;
}

export function buildAccountPriceCompareReport(opts: {
  accounts: string[];
  prices: InvoiceLatestPriceRow[];
  catalog?: Map<string, AccountPriceCompareCatalogItem>;
}): AccountPriceCompareReport {
  const accounts = parseAccountPriceCompareList(opts.accounts);
  const byAccount = accounts.map((account) => pricesForAccount(opts.prices, account));
  const skus = new Set<string>();
  for (const map of byAccount) {
    for (const sku of map.keys()) skus.add(sku);
  }

  const rows: AccountPriceCompareRow[] = Array.from(skus)
    .sort((a, b) => a.localeCompare(b))
    .map((sku) => {
      const catalog = opts.catalog?.get(sku);
      return {
        sku,
        itemDesc: accountPriceItemDesc(catalog),
        cells: byAccount.map((map) => map.get(sku) || { price: null, invoiceDate: "" }),
      };
    });

  return {
    accounts,
    skuCount: rows.length,
    rows,
  };
}

export function accountPriceCompareToCsv(report: AccountPriceCompareReport): {
  headerRows: string[][];
  rows: (string | number)[][];
} {
  return {
    headerRows: [["SKU", "item DESC", ...report.accounts]],
    rows: report.rows.map((row) => [
      row.sku,
      row.itemDesc,
      ...row.cells.map((cell) => formatAccountPriceCell(cell.price)),
    ]),
  };
}

export function accountPriceCompareCsvFileName(accounts: string[]) {
  const part = accounts.join("-") || "accounts";
  return `price-comp_${part}.csv`;
}

export function accountPriceRowDiffers(row: AccountPriceCompareRow) {
  const prices = row.cells
    .map((cell) => cell.price)
    .filter((price): price is number => price != null && Number.isFinite(price));
  if (prices.length < 2) return false;
  const first = prices[0];
  return prices.some((price) => price !== first);
}
