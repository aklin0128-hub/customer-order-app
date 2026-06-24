import { formatDate, parseDate } from "@/lib/analyticsCommon";
import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";

export type InvoiceRecencyKey = {
  effectiveDateMs: number;
  uploadedMs: number;
  invoiceNo: string;
  importId: string;
};

/** Invoice date when present; otherwise upload time so undated imports still compete. */
export function invoiceRecencyKey(record: InvoiceImportRecord): InvoiceRecencyKey | null {
  const effective = parseDate(record.invoiceDate) || parseDate(record.uploadedAt);
  if (!effective) return null;

  return {
    effectiveDateMs: effective.getTime(),
    uploadedMs: parseDate(record.uploadedAt)?.getTime() ?? 0,
    invoiceNo: String(record.invoiceNo || "").trim().toUpperCase(),
    importId: record.id,
  };
}

/** Positive when `a` is newer than `b`. */
export function compareInvoiceRecency(a: InvoiceRecencyKey, b: InvoiceRecencyKey): number {
  if (a.effectiveDateMs !== b.effectiveDateMs) return a.effectiveDateMs - b.effectiveDateMs;
  if (a.uploadedMs !== b.uploadedMs) return a.uploadedMs - b.uploadedMs;
  const invoiceNoCmp = a.invoiceNo.localeCompare(b.invoiceNo);
  if (invoiceNoCmp !== 0) return invoiceNoCmp;
  return a.importId.localeCompare(b.importId);
}

export function invoiceDateLabel(record: InvoiceImportRecord, effective: Date): string {
  const fromInvoice = parseDate(record.invoiceDate);
  if (fromInvoice) {
    return String(record.invoiceDate || "").trim() || formatDate(fromInvoice);
  }
  return formatDate(effective);
}

export function sortImportsByRecency(imports: InvoiceImportRecord[]): InvoiceImportRecord[] {
  return [...imports].sort((left, right) => {
    const leftKey = invoiceRecencyKey(left);
    const rightKey = invoiceRecencyKey(right);
    if (!leftKey && !rightKey) return 0;
    if (!leftKey) return 1;
    if (!rightKey) return -1;
    return compareInvoiceRecency(rightKey, leftKey);
  });
}
