import assert from "node:assert/strict";
import { test } from "node:test";

import { isProductOrderingBlocked, isProductOutOfStockStamp } from "./productAvailability";

test("regular product outOfStock shows stamp and blocks ordering", () => {
  const item = { sku: "123", outOfStock: true };
  assert.equal(isProductOutOfStockStamp(item), true);
  assert.equal(isProductOrderingBlocked(item), true);
});

test("new-item-only flags still work without general outOfStock", () => {
  const comingSoon = { isNew: true, newItemComingSoon: true };
  assert.equal(isProductOutOfStockStamp(comingSoon), false);
  assert.equal(isProductOrderingBlocked(comingSoon), true);
});
