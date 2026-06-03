import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLatestInvoicePricesFromImports,
  invoiceLatestPricesToCsv,
} from "./invoiceLatestPrices";
import type { InvoiceImportRecord } from "./invoice/invoiceImportRecord";

function record(partial: Partial<InvoiceImportRecord> & Pick<InvoiceImportRecord, "id" | "accountNo" | "lines">): InvoiceImportRecord {
  return {
    uploadedAt: "2026-01-01T12:00:00.000Z",
    invoiceNo: null,
    supplierOrderNo: null,
    invoiceDate: null,
    blobUrl: "",
    mimeType: "application/pdf",
    extractMethod: "pdf",
    lineCount: partial.lines.length,
    warnings: [],
    appliedToHistory: false,
    ...partial,
  };
}

test("buildLatestInvoicePricesFromImports keeps newest invoice price per account and sku", () => {
  const imports: InvoiceImportRecord[] = [
    record({
      id: "a",
      accountNo: "FL100",
      invoiceDate: "1/1/2026",
      uploadedAt: "2026-01-02T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 1, unitPrice: 10, inCatalog: true }],
    }),
    record({
      id: "b",
      accountNo: "FL100",
      invoiceDate: "2/1/2026",
      uploadedAt: "2026-02-02T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 2, unitPrice: 12.5, inCatalog: true }],
    }),
    record({
      id: "c",
      accountNo: "FL200",
      invoiceDate: "2/1/2026",
      uploadedAt: "2026-02-02T12:00:00.000Z",
      lines: [{ sku: "00200", qty: 1, unitPrice: 8, inCatalog: true }],
    }),
  ];

  assert.deepEqual(buildLatestInvoicePricesFromImports(imports), [
    { account: "FL100", sku: "00100", price: 12.5 },
    { account: "FL200", sku: "00200", price: 8 },
  ]);
});

test("invoiceLatestPricesToCsv uses account, sku, price columns", () => {
  const csv = invoiceLatestPricesToCsv([{ account: "FL1", sku: "ABC", price: 9.99 }]);
  assert.equal(csv, '"account","sku","price"\n"FL1","ABC","9.99"');
});
