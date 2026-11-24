import assert from "node:assert/strict";
import test from "node:test";

import { hasXlsxProductUpdate, parseInventoryFromXlsxRow } from "./catalogXlsxFields";

test("parseInventoryFromXlsxRow reads INV (10), including 0 and negatives", () => {
  assert.equal(parseInventoryFromXlsxRow({ "INV (10)": 869 }), 869);
  assert.equal(parseInventoryFromXlsxRow({ INV: 0 }), 0);
  assert.equal(parseInventoryFromXlsxRow({ Inventory: -23 }), -23);
  assert.equal(parseInventoryFromXlsxRow({ "INV (10)": "14" }), 14);
  assert.equal(parseInventoryFromXlsxRow({ Description: "Rice" }), undefined);
});

test("hasXlsxProductUpdate is true for inventory-only rows, including 0", () => {
  assert.equal(hasXlsxProductUpdate({ "INV (10)": 0 }), true);
  assert.equal(hasXlsxProductUpdate({ INV: 12 }), true);
  assert.equal(hasXlsxProductUpdate({ Description: "Rice" }), false);
});
