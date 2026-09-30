import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQtyDelta,
  applyQtySet,
  buildCartDisplayItems,
  expandOrderSubmitLines,
  getCatalogQty,
  getClearanceQty,
  nhItemsSkuSet,
} from "./orderNhItems";

test("clearance and catalog qty are independent per sku", () => {
  let maps = { catalog: {}, clearance: {} };
  maps = applyQtyDelta(maps, "A", 2, "clearance");
  maps = applyQtyDelta(maps, "A", 3, "normal");
  assert.equal(getClearanceQty(maps, "A"), 2);
  assert.equal(getCatalogQty(maps, "A"), 3);
  assert.deepEqual(expandOrderSubmitLines(maps), [
    { sku: "A", qty: "3" },
    { sku: "A", qty: "2", nhItems: true },
  ]);
  assert.deepEqual(buildCartDisplayItems(maps), expandOrderSubmitLines(maps));
});

test("catalog tab qty does not appear in clearance map", () => {
  let maps = { catalog: {}, clearance: {} };
  maps = applyQtyDelta(maps, "B", 5, "normal");
  assert.equal(getClearanceQty(maps, "B"), 0);
  assert.equal(nhItemsSkuSet(maps).size, 0);
});

test("clearance set only updates clearance map", () => {
  const maps = applyQtySet({ catalog: { C: "4" }, clearance: {} }, "C", "2", "clearance");
  assert.equal(getCatalogQty(maps, "C"), 4);
  assert.equal(getClearanceQty(maps, "C"), 2);
});

test("removing catalog qty leaves clearance qty for the same sku", () => {
  let maps = { catalog: { D: "3" }, clearance: { D: "2" } };
  maps = applyQtySet(maps, "D", "", "normal");
  assert.equal(getCatalogQty(maps, "D"), 0);
  assert.equal(getClearanceQty(maps, "D"), 2);
  assert.deepEqual(expandOrderSubmitLines(maps), [{ sku: "D", qty: "2", nhItems: true }]);
});

test("bulk clearance deltas accumulate across skus", () => {
  let maps = { catalog: {}, clearance: {} };
  for (const sku of ["A", "B", "C"]) {
    maps = applyQtyDelta(maps, sku, 1, "clearance");
  }
  assert.equal(getClearanceQty(maps, "A"), 1);
  assert.equal(getClearanceQty(maps, "B"), 1);
  assert.equal(getClearanceQty(maps, "C"), 1);
  assert.equal(expandOrderSubmitLines(maps).length, 3);
});
