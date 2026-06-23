import assert from "node:assert/strict";
import test from "node:test";

import { resolveInvoiceCaseUnitPrice } from "./invoice/invoiceCaseUnitPrice";

test("resolveInvoiceCaseUnitPrice prefers case unit over each", () => {
  assert.equal(
    resolveInvoiceCaseUnitPrice({ qty: 5, unitPrice: 45, eachPrice: 3.75, lineTotal: 225 }),
    45
  );
});

test("resolveInvoiceCaseUnitPrice fixes swapped unit and each columns", () => {
  assert.equal(
    resolveInvoiceCaseUnitPrice({ qty: 5, unitPrice: 3.75, eachPrice: 45, lineTotal: 225 }),
    45
  );
});

test("resolveInvoiceCaseUnitPrice derives case price from line total when only each was stored", () => {
  assert.equal(resolveInvoiceCaseUnitPrice({ qty: 5, unitPrice: 3.75, lineTotal: 225 }), 45);
});

test("resolveInvoiceCaseUnitPrice handles unit and total without each column", () => {
  assert.equal(resolveInvoiceCaseUnitPrice({ qty: 5, eachPrice: 45, lineTotal: 225 }), 45);
});
