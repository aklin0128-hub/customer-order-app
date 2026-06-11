import assert from "node:assert/strict";
import test from "node:test";

import {
  applyQtyDelta,
  applyQtySet,
  expandOrderSubmitLines,
  getNhQty,
  nhItemsSkuSet,
} from "./orderNhItems";

test("clearance adds tag qty; catalog adds normal only", () => {
  let maps = { total: {}, nh: {} };
  maps = applyQtyDelta(maps, "A", 2, "clearance");
  maps = applyQtyDelta(maps, "A", 3, "normal");
  assert.equal(getNhQty(maps, "A"), 2);
  assert.deepEqual(expandOrderSubmitLines(maps), [
    { sku: "A", qty: "3" },
    { sku: "A", qty: "2", nhItems: true },
  ]);
});

test("catalog order of same sku stays normal", () => {
  let maps = { total: {}, nh: {} };
  maps = applyQtyDelta(maps, "B", 5, "normal");
  assert.equal(nhItemsSkuSet(maps).size, 0);
  assert.deepEqual(expandOrderSubmitLines(maps), [{ sku: "B", qty: "5" }]);
});

test("reducing normal qty preserves nh portion", () => {
  let maps = applyQtySet({ total: { C: "5" }, nh: { C: "2" } }, "C", "4", "normal");
  assert.equal(getNhQty(maps, "C"), 2);
});
