import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isComingSoonNewItem,
  isNewItemOutOfStockStamp,
  isNewItemOrderingBlocked,
  readNewItemComingSoonForAdmin,
  readNewItemOutOfStockForAdmin,
} from "./comingSoonBadge";

test("split flags show each stamp independently", () => {
  const both = { isNew: true, newItemOutOfStock: true, newItemComingSoon: true };
  assert.equal(isComingSoonNewItem(both), true);
  assert.equal(isNewItemOutOfStockStamp(both), true);
  assert.equal(isNewItemOrderingBlocked(both), true);
});

test("legacy newItemOutOfStock maps to coming soon only", () => {
  const legacy = { isNew: true, newItemOutOfStock: true };
  assert.equal(isComingSoonNewItem(legacy), true);
  assert.equal(isNewItemOutOfStockStamp(legacy), false);
  assert.equal(readNewItemComingSoonForAdmin(legacy), true);
  assert.equal(readNewItemOutOfStockForAdmin(legacy), false);
});

test("explicit false coming soon with out of stock shows out-of-stock stamp only", () => {
  const outOnly = { isNew: true, newItemOutOfStock: true, newItemComingSoon: false };
  assert.equal(isComingSoonNewItem(outOnly), false);
  assert.equal(isNewItemOutOfStockStamp(outOnly), true);
});

test("general outOfStock on a new item shows stamp on new-item surfaces", () => {
  const item = { isNew: true, outOfStock: true, newItemComingSoon: false };
  assert.equal(isNewItemOutOfStockStamp(item), true);
  assert.equal(isComingSoonNewItem(item), false);
  assert.equal(isNewItemOrderingBlocked(item), true);
});
