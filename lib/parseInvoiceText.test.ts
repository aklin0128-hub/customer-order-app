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

function lineParsed(raw: string) {
  const parsed = parseInvoiceText(raw);
  assert.equal(parsed.lines.length, 1, `expected one line in: ${raw}`);
  return parsed.lines[0];
}

test("parseInvoiceText reads 03540K with pack size decimal 7.05 OZ on one line", () => {
  const line = lineParsed(
    "03540K SAMYANG BULDAK HOT CHICKEN FLAVOR SAUCE 2X12X7.05 OZ 300 Case Dry 80.00 3.33 24000.00"
  );
  assert.equal(line.qty, 300);
  assert.equal(line.unitPrice, 80);
  assert.equal(line.lineTotal, 24000);
});

test("parseInvoiceText joins split line when size contains 7.05 before qty Case", () => {
  const line = lineParsed(
    "03540K SAMYANG BULDAK HOT CHICKEN FLAVOR SAUCE 2X12X7.05 OZ\n300 Case Dry 80.00 3.33 24,000.00"
  );
  assert.equal(line.qty, 300);
  assert.equal(line.unitPrice, 80);
  assert.equal(line.lineTotal, 24000);
});

test("parseInvoiceText ignores partial row with only pack size decimal", () => {
  const parsed = parseInvoiceText("03540K SAMYANG BULDAK HOT CHICKEN FLAVOR SAUCE 2X12X7.05 OZ");
  assert.equal(parsed.lines.length, 0);
});
