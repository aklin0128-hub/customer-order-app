import { cleanSku } from "@/lib/analyticsCommon";
import { getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { getInvoiceLatestPrices } from "@/lib/invoiceLatestPrices";

import type { CustomerInvoicePriceEntry } from "@/lib/customerInvoicePriceDisplay";

export type { CustomerInvoicePriceEntry } from "@/lib/customerInvoicePriceDisplay";

/** Latest invoice unit prices for one account when admin enabled invoice pricing. */
export async function getCustomerInvoicePricesForOrder(accountNo: string): Promise<{
  enabled: boolean;
  prices: Record<string, CustomerInvoicePriceEntry>;
}> {
  const acct = normalizeAccountNo(accountNo);
  if (!acct) return { enabled: false, prices: {} };

  const customer = await getCustomerByAccount(acct);
  if (!customer?.invoicePricing) {
    return { enabled: false, prices: {} };
  }

  const rows = await getInvoiceLatestPrices({ accountNo: acct });
  const prices: Record<string, CustomerInvoicePriceEntry> = {};
  for (const row of rows) {
    const sku = cleanSku(row.sku) || String(row.sku || "").trim().toUpperCase();
    if (!sku) continue;
    prices[sku] = { price: row.price, invoiceDate: row.invoiceDate };
  }

  return { enabled: true, prices };
}
