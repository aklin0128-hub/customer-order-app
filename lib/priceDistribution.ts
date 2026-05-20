import {
  buildCatalogMap,
  cleanSku,
  loadInvoiceImports,
  median,
  parseDate,
  sinceFromDays,
} from "@/lib/analyticsCommon";
import { getAllCustomers } from "@/lib/customers";

export type AccountPriceRow = {
  accountNo: string;
  storeName: string;
  latestPrice: number;
  latestDate: string;
  qtyOnInvoice: number;
};

export type PriceDistributionResult = {
  sku: string;
  product: { name: string; brand: string; category: string; status: string } | null;
  days: number;
  summary: {
    accountCount: number;
    priceCount: number;
    min: number | null;
    max: number | null;
    median: number | null;
  };
  accounts: AccountPriceRow[];
};

export async function getPriceDistribution(options: {
  sku: string;
  days?: number;
}): Promise<PriceDistributionResult> {
  const sku = cleanSku(options.sku);
  const days = Number(options.days) > 0 ? Number(options.days) : 180;
  const since = sinceFromDays(days);

  const catalog = await buildCatalogMap([sku]);
  const product = catalog.get(sku);

  const customers = await getAllCustomers();
  const storeByAccount = new Map(
    customers.map((c) => [c.accountNo.toUpperCase(), c.storeName || ""])
  );

  const latestByAccount = new Map<
    string,
    { price: number; date: Date; qty: number }
  >();

  const imports = await loadInvoiceImports();
  for (const record of imports) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;

    const effectiveDate = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
    if (!effectiveDate || (since && effectiveDate < since)) continue;

    for (const line of record.lines || []) {
      if (cleanSku(line.sku) !== sku) continue;
      const price =
        typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)
          ? line.unitPrice
          : null;
      if (price === null || price <= 0) continue;

      const qty = Number(line.qty) || 0;
      const prev = latestByAccount.get(acct);
      if (!prev || effectiveDate >= prev.date) {
        latestByAccount.set(acct, { price, date: effectiveDate, qty });
      }
    }
  }

  const accounts: AccountPriceRow[] = Array.from(latestByAccount.entries())
    .map(([accountNo, row]) => ({
      accountNo,
      storeName: storeByAccount.get(accountNo) || "",
      latestPrice: Math.round(row.price * 100) / 100,
      latestDate: row.date.toISOString().slice(0, 10),
      qtyOnInvoice: row.qty,
    }))
    .sort((a, b) => a.latestPrice - b.latestPrice);

  const prices = accounts.map((a) => a.latestPrice);

  return {
    sku,
    product: product
      ? {
          name: product.name || "",
          brand: product.brand || "",
          category: product.category || "",
          status: product.status || "",
        }
      : null,
    days,
    summary: {
      accountCount: accounts.length,
      priceCount: prices.length,
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      median: median(prices),
    },
    accounts,
  };
}
