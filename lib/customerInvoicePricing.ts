import { cleanSku } from "@/lib/analyticsCommon";
import { getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { getInvoiceLatestPrices } from "@/lib/invoiceLatestPrices";

export type CustomerInvoicePriceEntry = {
  price: number;
  invoiceDate: string;
};

export function formatInvoiceUnitPrice(price: number) {
  if (!Number.isFinite(price)) return "";
  return `$${price.toFixed(2)}`;
}

export function formatCustomerInvoicePriceLabel(
  sku: string,
  prices: Record<string, CustomerInvoicePriceEntry>,
  prefix: string
) {
  const key = cleanSku(sku) || String(sku || "").trim().toUpperCase();
  const entry = prices[key];
  if (!entry || !Number.isFinite(entry.price)) return undefined;
  const money = formatInvoiceUnitPrice(entry.price);
  return prefix ? `${prefix}: ${money}` : money;
}

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
