import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCustomerInvoicePriceLabel,
  formatInvoiceUnitPrice,
} from "./customerInvoicePriceDisplay";

test("formatInvoiceUnitPrice", () => {
  assert.equal(formatInvoiceUnitPrice(12.5), "$12.50");
});

test("formatCustomerInvoicePriceLabel when price exists", () => {
  const label = formatCustomerInvoicePriceLabel(
    "00100",
    { "00100": { price: 9.99, invoiceDate: "2026-01-15" } },
    "Last price"
  );
  assert.equal(label, "Last price: $9.99");
});

test("formatCustomerInvoicePriceLabel returns undefined without price", () => {
  assert.equal(formatCustomerInvoicePriceLabel("99999", {}, "Last price"), undefined);
});
