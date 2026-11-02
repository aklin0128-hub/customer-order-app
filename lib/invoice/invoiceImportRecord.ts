import type { ParsedInvoiceLine } from "./parseInvoiceText";

export type InvoiceLineWithCatalog = ParsedInvoiceLine & {
  inCatalog: boolean;
};

export type InvoiceImportRecord = {
  id: string;
  uploadedAt: string;
  accountNo: string;
  invoiceNo: string | null;
  supplierOrderNo: string | null;
  invoiceDate: string | null;
  blobUrl: string;
  blobPathname?: string;
  mimeType: string;
  extractMethod: "pdf" | "ocr";
  lineCount: number;
  lines: InvoiceLineWithCatalog[];
  /** Compact list copies: unknown SKUs without storing every invoice line. */
  unknownSkus?: string[];
  warnings: string[];
  appliedToHistory: boolean;
};

export const IMPORT_LIST_KEY = "invoiceImports:list";
export const INVOICE_LINES_KEY_PREFIX = "invoiceImports:lines:";

export function resolveInvoiceBlobPathname(
  record: Pick<InvoiceImportRecord, "blobPathname" | "blobUrl">
): string | null {
  const pathname = String(record.blobPathname || "").trim();
  if (pathname.startsWith("invoices/")) return pathname;

  const blobUrl = String(record.blobUrl || "").trim();
  if (!blobUrl) return null;

  try {
    const fromPath = new URL(blobUrl).pathname.replace(/^\//, "");
    if (fromPath.startsWith("invoices/")) return fromPath;
  } catch {
    // ignore invalid URLs
  }

  return null;
}
