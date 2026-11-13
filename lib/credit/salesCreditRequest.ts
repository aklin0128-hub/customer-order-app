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
  itemDetail: string;
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
    itemDetail: "",
  }));
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
