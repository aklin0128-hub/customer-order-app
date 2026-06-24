import { Buffer } from "node:buffer";

import { get } from "@vercel/blob";

import { skuIsInCatalog } from "@/lib/invoice/catalogSku";
import { extractInvoiceText } from "@/lib/invoice/extractText";
import type { InvoiceImportRecord, InvoiceLineWithCatalog } from "@/lib/invoice/invoiceImportRecord";
import { parseInvoiceText } from "@/lib/invoice/parseInvoiceText";

async function loadInvoiceBlobBuffer(record: InvoiceImportRecord): Promise<Buffer> {
  const pathname = record.blobPathname;
  if (!pathname || !pathname.startsWith("invoices/")) {
    throw new Error("No stored invoice file for this import.");
  }

  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Invoice file not found in storage.");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of result.stream as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Re-read stored PDF/image and refresh parsed lines using the current parser. */
export async function reparseInvoiceImportRecord(
  record: InvoiceImportRecord
): Promise<InvoiceImportRecord> {
  const buffer = await loadInvoiceBlobBuffer(record);
  const { text, method } = await extractInvoiceText(buffer, record.mimeType || "application/pdf");
  const parsed = parseInvoiceText(text);

  const linesWithFlags: InvoiceLineWithCatalog[] = await Promise.all(
    parsed.lines.map(async (line) => ({
      ...line,
      inCatalog: await skuIsInCatalog(line.sku),
    }))
  );

  const warnings = [...parsed.warnings];
  if (linesWithFlags.length === 0) {
    warnings.unshift("Re-parse matched zero lines — check the saved file or parser rules.");
  }

  return {
    ...record,
    extractMethod: method,
    lineCount: linesWithFlags.length,
    lines: linesWithFlags,
    warnings,
    invoiceNo: parsed.invoiceNo ?? record.invoiceNo,
    supplierOrderNo: parsed.supplierOrderNo ?? record.supplierOrderNo,
    invoiceDate: parsed.invoiceDate ?? record.invoiceDate,
    accountNo: record.accountNo || parsed.accountNo || "",
  };
}
