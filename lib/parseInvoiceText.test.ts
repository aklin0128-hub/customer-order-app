import assert from "node:assert/strict";
import test from "node:test";

import { parseInvoiceText } from "./invoice/parseInvoiceText";

function linePrice(raw: string) {
  const parsed = parseInvoiceText(raw);
  assert.equal(parsed.lines.length, 1, `expected one line in: ${raw}`);
  return parsed.lines[0].unitPrice;
}

test("parseInvoiceText reads Unit column not Each for Dry rows", () => {
  const price = linePrice("10495K RHEEBROS NOODLE RAMEN 12 Case Dry 45.00 3.75 540.00");
  assert.equal(price, 45);
});

test("parseInvoiceText reads Unit column for no-brand rows", () => {
  const price = linePrice("10495K ABC CO 12 Case REF 45.00 3.75 540.00");
  assert.equal(price, 45);
});

test("parseInvoiceText reads Unit column for loose type rows", () => {
  const price = linePrice("10495K ABC CO 12 Case GROC 45.00 3.75 540.00");
  assert.equal(price, 45);
});

test("parseInvoiceText flexible parser uses case unit when only each and total appear", () => {
  const price = linePrice("10495K ABC CO 5 Case 3.75 225.00");
  assert.equal(price, 45);
});
