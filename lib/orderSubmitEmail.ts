import { formatClearancePriceDisplay } from "@/lib/clearanceFormat";
import { ndhListingKey } from "@/lib/ndhListParse";
import { CLEARANCE_ORDER_EMAIL_TAG, NDH_ORDER_EMAIL_TAG } from "@/lib/orderEmailTags";

export type OrderEmailLine = {
  sku: string;
  qty: string;
  nhItems?: boolean;
  ndh?: boolean;
  expiryDate?: string;
  /** NDH listing price — used in the Tag column instead of the expiry date. */
  price?: string;
};

export function isNdhEmailLine(item: OrderEmailLine) {
  return Boolean(item.ndh || item.nhItems);
}

export function splitOrderLinesForEmail(items: OrderEmailLine[]) {
  const catalog: OrderEmailLine[] = [];
  const ndh: OrderEmailLine[] = [];
  for (const item of items) {
    if (isNdhEmailLine(item)) ndh.push(item);
    else catalog.push(item);
  }
  return { catalog, ndh };
}

export function ndhTagPrice(price?: string) {
  const raw = String(price || "").trim();
  if (!raw) return "";
  return formatClearancePriceDisplay(raw) || raw;
}

export type NdhPriceListing = {
  sku?: string;
  expiryDate?: string;
  clearancePrice?: string;
  price?: string;
};

function listingPrice(row: NdhPriceListing) {
  return String(row.clearancePrice || row.price || "").trim();
}

/** Fill NDH line prices from live listings (exact sku+date, then unique sku, then existing). */
export function attachNdhPrices<T extends OrderEmailLine>(lines: T[], listings: NdhPriceListing[]): T[] {
  const byKey = new Map<string, string>();
  const bySku = new Map<string, Set<string>>();

  for (const row of listings) {
    const sku = String(row.sku || "").trim().toUpperCase();
    const price = listingPrice(row);
    if (!sku || !price) continue;
    byKey.set(ndhListingKey(sku, row.expiryDate), price);
    if (!bySku.has(sku)) bySku.set(sku, new Set());
    bySku.get(sku)!.add(price);
  }

  return lines.map((item) => {
    if (!item.ndh) return item;
    const sku = String(item.sku || "").trim().toUpperCase();
    const exact = byKey.get(ndhListingKey(sku, item.expiryDate)) || "";
    const skuPrices = bySku.get(sku);
    const skuOnly = skuPrices && skuPrices.size === 1 ? [...skuPrices][0] : "";
    const price = exact || String(item.price || "").trim() || skuOnly || undefined;
    return { ...item, price };
  });
}

export function buildOrderDownloadCsv(items: OrderEmailLine[]) {
  if (items.some((item) => item.ndh || item.price)) return buildCsv(items, "ndh");
  const rows = [["SKU", "Qty"]];
  for (const item of items) {
    rows.push([String(item.sku || "").trim().toUpperCase(), String(item.qty || "").trim()]);
  }
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function lineTag(item: OrderEmailLine) {
  if (item.ndh) return ndhTagPrice(item.price);
  if (item.nhItems) return CLEARANCE_ORDER_EMAIL_TAG;
  return "";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function formatOrderLine(item: OrderEmailLine) {
  const sku = String(item.sku || "").trim().toUpperCase();
  const qty = String(item.qty || "").trim();
  const tag = lineTag(item);
  return tag ? `${sku} - ${qty} - ${tag}` : `${sku} - ${qty}`;
}

export function buildCsv(items: OrderEmailLine[], kind: "catalog" | "ndh" = "catalog") {
  const rows = kind === "ndh" ? [["SKU", "QTY", "PRICE"]] : [["SKU", "Qty", "Tag"]];

  for (const item of items) {
    const sku = String(item.sku || "").trim().toUpperCase();
    const qty = String(item.qty || "").trim();
    const third = kind === "ndh" ? ndhTagPrice(item.price) : lineTag(item);
    rows.push([sku, qty, third]);
  }

  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function buildOrderEmail(options: {
  kind: "catalog" | "ndh";
  accountNo: string;
  storeName: string;
  phone: string;
  note: string;
  orderEmail: string;
  orderRef: string;
  items: OrderEmailLine[];
  companionSplit: boolean;
}) {
  const { kind, accountNo, storeName, phone, note, orderEmail, orderRef, items, companionSplit } = options;
  const isNdh = kind === "ndh";
  const emailRef = isNdh ? `${orderRef}-NDH` : orderRef;
  const today = new Date().toISOString().slice(0, 10);
  const filename = isNdh ? `${accountNo}_NDH_${today}.csv` : `${accountNo}_order_${today}.csv`;
  const subject = isNdh
    ? `New NDH Order - ${accountNo} - ${storeName} - ${emailRef}`
    : `New Order - ${accountNo} - ${storeName} - ${emailRef}`;

  const splitNote = companionSplit
    ? isNdh
      ? "This email is NDH only. Regular items were sent in a separate order email."
      : "NDH items were sent in a separate NDH email."
    : "";

  const text = [
    isNdh ? "New NDH order received." : "New order received.",
    ``,
    `Account: ${accountNo}`,
    `Store: ${storeName}`,
    `Order email: ${orderEmail}`,
    `Phone: ${phone || "-"}`,
    `Note: ${note || "-"}`,
    `Ref: ${emailRef}`,
    `Items: ${items.length}`,
    ...(isNdh ? [`NDH (${NDH_ORDER_EMAIL_TAG}): ${items.length}`] : []),
    ...(splitNote ? [``, splitNote] : []),
    ``,
    ...items.map((item) => formatOrderLine(item)),
  ].join("\n");

  return {
    subject,
    text,
    filename,
    csv: buildCsv(items, kind),
    emailRef,
  };
}
