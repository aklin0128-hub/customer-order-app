import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQtyDelta,
  applyQtySet,
  buildCartDisplayItems,
  cartLinePoolKey,
  expandOrderSubmitLines,
  getCatalogQty,
  getClearanceQty,
  getNdhQty,
  ndhSkuSet,
  nhItemsSkuSet,
  type QtyMaps,
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

test("ndh qty is independent from catalog and clearance", () => {
  let maps = applyQtyDelta({ catalog: {}, clearance: {} }, "D", 2, "ndh");
  maps = applyQtyDelta(maps, "D", 1, "normal");
  maps = applyQtyDelta(maps, "D", 3, "clearance");
  assert.equal(getNdhQty(maps, "D"), 2);
  assert.equal(getCatalogQty(maps, "D"), 1);
  assert.equal(getClearanceQty(maps, "D"), 3);
  assert.equal(ndhSkuSet(maps).has("D"), true);
  assert.deepEqual(
    expandOrderSubmitLines(maps).find((row) => row.ndh),
    { sku: "D", qty: "2", ndh: true }
  );
  assert.equal(cartLinePoolKey({ sku: "D", ndh: true }), "ndh:D");
  assert.equal(cartLinePoolKey({ sku: "D", nhItems: true }), "D::nh");
});

test("ndh qty is independent per expiry date", () => {
  let maps = applyQtyDelta({ catalog: {}, clearance: {} }, "10466K", 2, "ndh", "2026-12-16");
  maps = applyQtyDelta(maps, "10466K", 3, "ndh", "2026-11-12");
  assert.equal(getNdhQty(maps, "10466K", "2026-12-16"), 2);
  assert.equal(getNdhQty(maps, "10466K", "2026-11-12"), 3);
  const lines = expandOrderSubmitLines(maps).filter((row) => row.ndh);
  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.find((row) => row.expiryDate === "2026-12-16"),
    { sku: "10466K", qty: "2", ndh: true, expiryDate: "2026-12-16" }
  );
});

test("removing catalog qty leaves clearance qty for the same sku", () => {
  let maps: QtyMaps = { catalog: { D: "3" }, clearance: { D: "2" } };
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
