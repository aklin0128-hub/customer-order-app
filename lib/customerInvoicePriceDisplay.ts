import { cleanSku } from "@/lib/analyticsPure";

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
