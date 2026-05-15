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
  warnings: string[];
  appliedToHistory: boolean;
};

export const IMPORT_LIST_KEY = "invoiceImports:list";
