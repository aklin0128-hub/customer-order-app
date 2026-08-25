import assert from "node:assert/strict";
import { test } from "node:test";

import type { InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { buildSkuInvoicePricePointsFromImports } from "@/lib/skuInvoicePriceHistory";
import {
  attachUnitPricesToSkuHistory,
  invoiceNoFromOrderRef,
  orderRefFromInvoiceNo,
} from "@/lib/skuInvoicePriceHistoryPure";

function record(
  partial: Partial<InvoiceImportRecord> & Pick<InvoiceImportRecord, "id" | "accountNo" | "lines">
): InvoiceImportRecord {
  return {
    uploadedAt: "2026-08-01T12:00:00.000Z",
    invoiceNo: null,
    supplierOrderNo: null,
    invoiceDate: null,
    blobUrl: "https://example.com/inv.pdf",
    mimeType: "application/pdf",
    extractMethod: "pdf",
    lineCount: partial.lines.length,
    warnings: [],
    appliedToHistory: true,
    ...partial,
  };
}

test("orderRef helpers normalize invoice numbers", () => {
  assert.equal(orderRefFromInvoiceNo("12/34"), "INV-12_34");
  assert.equal(invoiceNoFromOrderRef("INV-12_34"), "12_34");
});

test("buildSkuInvoicePricePointsFromImports filters account + sku", () => {
  const imports = [
    record({
      id: "a",
      accountNo: "C1",
      invoiceNo: "100",
      invoiceDate: "2026-07-01",
      lines: [{ sku: "00100", qty: 2, unitPrice: 10, inCatalog: true }],
    }),
    record({
      id: "b",
      accountNo: "C1",
      invoiceNo: "200",
      invoiceDate: "2026-08-01",
      lines: [{ sku: "00100", qty: 1, unitPrice: 12.5, inCatalog: true }],
    }),
    record({
      id: "c",
      accountNo: "C2",
      invoiceNo: "300",
      invoiceDate: "2026-08-02",
      lines: [{ sku: "00100", qty: 1, unitPrice: 99, inCatalog: true }],
    }),
  ];

  const points = buildSkuInvoicePricePointsFromImports(imports, "c1", "00100");
  assert.equal(points.length, 2);
  assert.equal(points[0]?.orderRef, "INV-200");
  assert.equal(points[0]?.unitPrice, 12.5);
  assert.equal(points[1]?.orderRef, "INV-100");
  assert.equal(points[1]?.unitPrice, 10);
});

test("attachUnitPricesToSkuHistory prefers stored, then orderRef, then day", () => {
  const points = [
    {
      orderRef: "INV-200",
      invoiceDate: "2026-08-01",
      uploadedAt: "2026-08-02T00:00:00.000Z",
      unitPrice: 12.5,
    },
    {
      orderRef: "INV-100",
      invoiceDate: "2026-07-01",
      uploadedAt: "2026-07-02T00:00:00.000Z",
      unitPrice: 10,
    },
  ];

  const attached = attachUnitPricesToSkuHistory(
    [
      { orderRef: "ORD-1", createdAt: "2026-08-10T12:00:00.000Z", qty: 1, unitPrice: 9 },
      { orderRef: "INV-200", createdAt: "2026-08-03T12:00:00.000Z", qty: 2 },
      { orderRef: "X", createdAt: "2026-07-01T18:00:00.000Z", qty: 3 },
      { orderRef: "Y", createdAt: "2026-06-15T12:00:00.000Z", qty: 1 },
    ],
    points
  );

  assert.equal(attached[0]?.unitPrice, 9);
  assert.equal(attached[1]?.unitPrice, 12.5);
  assert.equal(attached[2]?.unitPrice, 10);
  assert.equal(attached[3]?.unitPrice, undefined);
});
