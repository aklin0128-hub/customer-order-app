import { CLEARANCE_ORDER_EMAIL_TAG } from "@/lib/clearance";
import { NDH_ORDER_EMAIL_TAG } from "@/lib/ndh";

export type OrderEmailLine = {
  sku: string;
  qty: string;
  nhItems?: boolean;
  ndh?: boolean;
  expiryDate?: string;
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

export function lineTag(item: OrderEmailLine) {
  if (item.ndh) {
    const exp = String(item.expiryDate || "").trim();
    return exp ? `${NDH_ORDER_EMAIL_TAG} ${exp}` : NDH_ORDER_EMAIL_TAG;
  }
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

export function buildCsv(items: OrderEmailLine[]) {
  const rows = [["SKU", "Qty", "Tag"]];

  for (const item of items) {
    const sku = String(item.sku || "").trim().toUpperCase();
    const qty = String(item.qty || "").trim();
    rows.push([sku, qty, lineTag(item)]);
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
    csv: buildCsv(items),
    emailRef,
  };
}
