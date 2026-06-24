import {
  buildCatalogMap,
  cleanSku,
  loadInvoiceImports,
  median,
  sinceFromDays,
} from "@/lib/analyticsCommon";
import { getAllCustomers } from "@/lib/customers";
import { resolveInvoiceCaseUnitPrice } from "@/lib/invoice/invoiceCaseUnitPrice";
import { invoiceRecencyKey, sortImportsByRecency } from "@/lib/invoice/invoiceRecency";

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
  for (const record of sortImportsByRecency(imports)) {
    const acct = String(record.accountNo || "").trim().toUpperCase();
    if (!acct) continue;

    const recency = invoiceRecencyKey(record);
    if (!recency) continue;
    if (since && recency.effectiveDateMs < since.getTime()) continue;

    for (const line of record.lines || []) {
      if (cleanSku(line.sku) !== sku) continue;
      if (latestByAccount.has(acct)) continue;

      const price = resolveInvoiceCaseUnitPrice({
        qty: line.qty,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      });
      if (price === undefined || price <= 0) continue;

      const qty = Number(line.qty) || 0;
      latestByAccount.set(acct, {
        price,
        date: new Date(recency.effectiveDateMs),
        qty,
      });
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
