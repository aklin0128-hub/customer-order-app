import {
  INVOICE_LINES_KEY_PREFIX,
  type InvoiceImportRecord,
  type InvoiceLineWithCatalog,
} from "./invoiceImportRecord";

export function compactInvoiceLine(line: InvoiceLineWithCatalog): InvoiceLineWithCatalog {
  const next: InvoiceLineWithCatalog = {
    sku: String(line.sku || "").trim(),
    qty: Number(line.qty) || 0,
    inCatalog: Boolean(line.inCatalog),
  };
  if (typeof line.unitPrice === "number" && Number.isFinite(line.unitPrice)) {
    next.unitPrice = line.unitPrice;
  }
  if (typeof line.lineTotal === "number" && Number.isFinite(line.lineTotal)) {
    next.lineTotal = line.lineTotal;
  }
  return next;
}

export function compactInvoiceLines(lines: InvoiceLineWithCatalog[] = []) {
  return lines.map(compactInvoiceLine);
}

export function unknownSkusFromLines(lines: InvoiceLineWithCatalog[] = []) {
  return [
    ...new Set(
      lines
        .filter((line) => !line.inCatalog && line.sku)
        .map((line) => String(line.sku).trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
}

export function toInvoiceImportSummary(record: InvoiceImportRecord): InvoiceImportRecord {
  const lines = compactInvoiceLines(record.lines || []);
  const unknownSkus = lines.length
    ? unknownSkusFromLines(lines)
    : record.unknownSkus || unknownSkusFromLines(record.lines || []);
  return {
    ...record,
    lineCount: record.lineCount || lines.length,
    unknownSkus,
    lines: [],
  };
}

export function estimatedJsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

export function invoiceLinesRedisKey(id: string) {
  return `${INVOICE_LINES_KEY_PREFIX}${String(id || "").trim()}`;
}
