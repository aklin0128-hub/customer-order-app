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

test("parseInvoiceText reads laver SKUs with small pack decimals 0.14 and 0.17", () => {
  const cases = [
    {
      sku: "07192K",
      raw: "07192K DONGWON ROASTED SEASONED LAVER 10X12X0.17 OZ 50 Case Dry 46.00 3.83 2300.00",
      qty: 50,
      unit: 46,
      total: 2300,
    },
    {
      sku: "07196K",
      raw: "07196K KWANGCHEON ROASTED SEASONED LAVER 8X16X0.14 OZ 100 Case Dry 44.00 2.75 4400.00",
      qty: 100,
      unit: 44,
      total: 4400,
    },
    {
      sku: "07300K",
      raw: "07300K ASSI ROASTED SEASONED LAVER 10X20X0.14 OZ 80 Case Dry 59.00 2.95 4720.00",
      qty: 80,
      unit: 59,
      total: 4720,
    },
  ];

  for (const row of cases) {
    const line = lineParsed(row.raw);
    assert.equal(line.sku, row.sku, row.sku);
    assert.equal(line.qty, row.qty, row.sku);
    assert.equal(line.unitPrice, row.unit, row.sku);
    assert.equal(line.lineTotal, row.total, row.sku);
  }
});

test("parseInvoiceText joins laver SKU lines split after pack size decimal", () => {
  const line = lineParsed(
    "07196K KWANGCHEON ROASTED SEASONED LAVER 8X16X0.14 OZ\n100 Case Dry 44.00 2.75 4,400.00"
  );
  assert.equal(line.qty, 100);
  assert.equal(line.unitPrice, 44);
  assert.equal(line.lineTotal, 4400);
});

test("parseInvoiceText does not treat pack size decimal as unit price for laver SKUs", () => {
  const parsed = parseInvoiceText("07196K KWANGCHEON ROASTED SEASONED LAVER 8X16X0.14 OZ");
  assert.equal(parsed.lines.length, 0);
});

test("parseInvoiceText reads integer unit and each amounts before decimal total", () => {
  const line = lineParsed(
    "07196K KWANGCHEON ROASTED SEASONED LAVER 8X16X0.14 OZ 100 Case Dry 44 2.75 4400.00"
  );
  assert.equal(line.unitPrice, 44);
  assert.equal(line.lineTotal, 4400);
});

test("parseInvoiceText ignores false 14 Case from pack size 0.14", () => {
  const parsed = parseInvoiceText(
    "07196K KWANGCHEON ROASTED SEASONED LAVER 8X16X0.14 Case Dry 44.00 2.75 4400.00"
  );
  assert.equal(parsed.lines.length, 0);
});

test("parseInvoiceText reads laver SKU with product count in name (16P)", () => {
  const line = lineParsed(
    "07300K ASSI ROASTED SEASONED LAVER (16+4P) 10X20X0.14 OZ 80 Case Dry 59 2.95 4720.00"
  );
  assert.equal(line.qty, 80);
  assert.equal(line.unitPrice, 59);
});

test("parseInvoiceText ignores company and ship-to street numbers like 7461 and 7700", () => {
  const parsed = parseInvoiceText(`
RHEEBROS
7461 Coca Cola Dr, Hanover, MD 21076
Phone 410-381-9000
Invoice No PSI-0176747
Customer No FL410
Bill To ENSON MARKET
7700 PETERS ROAD, DAVIE, FL 33324, USA
No. Brand Description Size Qty. UM Type Unit Each Total
00012D RHEECHUN EXTRA FANCY BROWN RICE 15 LB 10 Case Dry 13.00 1.30 130.00
01045D ASSI RICE 9X5 LB 2 Case Dry 50.15 5.02 100.30
Subtotal 230.30
`);
  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(
    parsed.lines.map((line) => line.sku),
    ["00012D", "01045D"]
  );
  assert.equal(parsed.lines.some((line) => line.sku === "7461"), false);
  assert.equal(parsed.lines.some((line) => line.sku === "7700"), false);
});

test("parseInvoiceText ignores bill-to street number 4850 N.UNIVERSITY DR", () => {
  const parsed = parseInvoiceText(`
Customer No FL111
Bill To
KIM & LEE ORIENTAL
KIM
4850 N.UNIVERSITY DR
FT. LAUDERDALE, FL 33351, USA
No. Brand Description Size Qty. UM Type Unit Each Total
06201C BRAND ITEM A 10 Case Dry 98.00 9.80 980.00
08038K BRAND ITEM B 2 Case Dry 50.00 5.00 100.00
Subtotal 1080.00
`);
  assert.equal(parsed.lines.length, 2);
  assert.deepEqual(
    parsed.lines.map((line) => line.sku),
    ["06201C", "08038K"]
  );
  assert.equal(parsed.lines.some((line) => line.sku === "4850"), false);
});

test("parseInvoiceText still reads short numeric item# on product rows when suffix is missing", () => {
  const line = lineParsed("8180 BRAND NAME 15 LB 10 Case Dry 13.00 1.30 130.00");
  assert.equal(line.sku, "8180");
  assert.equal(line.qty, 10);
});
