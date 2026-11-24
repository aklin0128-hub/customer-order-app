export const SALES_CREDIT_EMAIL = "ELIN@RHEEBROS.COM";

export const SALES_CREDIT_REASONS = [
  "Allowance & Promotion",
  "Damage",
  "Expiration Date Issue",
  "Manufacturing Defect",
  "Product Quality",
  "Rebate",
  "Sales Error",
] as const;

export type SalesCreditReason = (typeof SALES_CREDIT_REASONS)[number];

export type SalesCreditLine = {
  reason: SalesCreditReason;
  amount: number | null;
  /** Raw Amount field so a trailing decimal (e.g. `12.`) is not stripped while typing. */
  amountInput: string;
  itemDetail: string;
  memo: string;
};

export type SalesCreditRequestForm = {
  salesId: string;
  customerNo: string;
  customerName: string;
  dateOfRequest: string;
  customerEmail: string;
  invoiceNo: string;
  invoiceDate: string;
  lines: SalesCreditLine[];
};

export type SalesCreditPhoto = {
  bytes: Uint8Array;
  name?: string;
};

export function emptySalesCreditLines(): SalesCreditLine[] {
  return SALES_CREDIT_REASONS.map((reason) => ({
    reason,
    amount: null,
    amountInput: "",
    itemDetail: "",
    memo: "",
  }));
}

/** Dollars with up to two decimal places, including a trailing `.` while typing. */
export const SALES_CREDIT_AMOUNT_INPUT = /^-?\d*(?:\.\d{0,2})?$/;

export function isSalesCreditAmountInput(raw: string): boolean {
  return SALES_CREDIT_AMOUNT_INPUT.test(raw);
}

export function parseSalesCreditAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-" || t === "." || t === "-.") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function salesCreditTotal(lines: SalesCreditLine[]) {
  return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

export function formatSalesCreditMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSalesCreditDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(m)}/${Number(d)}/${y}`;
}

/** `sales-credit-request_FL168.pdf` from Customer #. */
export function salesCreditRequestPdfFileName(customerNo: string) {
  const acct = String(customerNo || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  return acct ? `sales-credit-request_${acct}.pdf` : "sales-credit-request.pdf";
}
