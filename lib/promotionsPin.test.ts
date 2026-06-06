import assert from "node:assert/strict";
import test from "node:test";

import { isPinnedPromotion, sortPromotionRecords, type PromotionRecord } from "./promotions";

test("sortPromotionRecords puts pinned promos first", () => {
  const records: PromotionRecord[] = [
    { sku: "A" },
    { sku: "B", pinned: true },
    { sku: "C" },
    { sku: "D", pinned: true },
  ];
  const sorted = sortPromotionRecords(records);
  assert.deepEqual(sorted.map((record) => record.sku), ["B", "D", "A", "C"]);
});

test("isPinnedPromotion reads boolean flag", () => {
  assert.equal(isPinnedPromotion({ pinned: true }), true);
  assert.equal(isPinnedPromotion({ pinned: false }), false);
  assert.equal(isPinnedPromotion({}), false);
});
