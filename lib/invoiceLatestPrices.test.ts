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

test("buildLatestInvoicePricesFromImports uses case unit from line total when each was stored", () => {
  const imports: InvoiceImportRecord[] = [
    record({
      id: "each-stored",
      accountNo: "FL100",
      invoiceDate: "1/15/2026",
      lines: [{ sku: "00100", qty: 5, unitPrice: 3.75, lineTotal: 225, inCatalog: true }],
    }),
  ];

  assert.deepEqual(buildLatestInvoicePricesFromImports(imports), [
    { account: "FL100", sku: "00100", price: 45, invoiceDate: "2026-01-15" },
  ]);
});

test("buildLatestInvoicePricesFromImports uses invoice date not upload time", () => {
  const imports: InvoiceImportRecord[] = [
    record({
      id: "newer-upload",
      accountNo: "FL100",
      invoiceDate: "1/15/2026",
      uploadedAt: "2026-03-15T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 1, unitPrice: 99, inCatalog: true }],
    }),
    record({
      id: "older-upload",
      accountNo: "FL100",
      invoiceDate: "2/20/2026",
      uploadedAt: "2026-01-05T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 2, unitPrice: 12.5, inCatalog: true }],
    }),
  ];

  assert.deepEqual(buildLatestInvoicePricesFromImports(imports), [
    { account: "FL100", sku: "00100", price: 12.5, invoiceDate: "2026-02-20" },
  ]);
});

test("buildLatestInvoicePricesFromImports uses upload date when invoice date is missing", () => {
  const imports: InvoiceImportRecord[] = [
    record({
      id: "with-date",
      accountNo: "FL100",
      invoiceDate: "3/1/2026",
      uploadedAt: "2026-01-01T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 1, unitPrice: 11, inCatalog: true }],
    }),
    record({
      id: "no-date",
      accountNo: "FL100",
      invoiceDate: null,
      uploadedAt: "2026-05-01T12:00:00.000Z",
      lines: [{ sku: "00100", qty: 1, unitPrice: 50, inCatalog: true }],
    }),
  ];

  assert.deepEqual(buildLatestInvoicePricesFromImports(imports), [
    { account: "FL100", sku: "00100", price: 50, invoiceDate: "2026-05-01" },
  ]);
});

test("buildLatestInvoicePricesFromImports keeps price from newest invoice that contains each sku", () => {
  const imports: InvoiceImportRecord[] = [
    record({
      id: "older",
      accountNo: "FL100",
      invoiceDate: "1/10/2026",
      lines: [
        { sku: "00100", qty: 1, unitPrice: 10, inCatalog: true },
        { sku: "00200", qty: 1, unitPrice: 20, inCatalog: true },
      ],
    }),
    record({
      id: "newer",
      accountNo: "FL100",
      invoiceDate: "3/10/2026",
      lines: [{ sku: "00100", qty: 1, unitPrice: 12, inCatalog: true }],
    }),
  ];

  assert.deepEqual(buildLatestInvoicePricesFromImports(imports), [
    { account: "FL100", sku: "00100", price: 12, invoiceDate: "2026-03-10" },
    { account: "FL100", sku: "00200", price: 20, invoiceDate: "2026-01-10" },
  ]);
});

test("invoiceLatestPricesToCsv outputs only account, sku, price columns", () => {
  const csv = invoiceLatestPricesToCsv([
    { account: "FL1", sku: "ABC", price: 9.99, invoiceDate: "2026-04-01" },
  ]);
  assert.equal(csv, '"account","sku","price"\n"FL1","ABC","9.99"');
  assert.equal(csv.includes("invoice"), false);
});
