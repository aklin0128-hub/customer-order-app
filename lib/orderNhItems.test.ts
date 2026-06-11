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
