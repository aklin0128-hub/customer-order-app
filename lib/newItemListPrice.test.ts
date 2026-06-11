import assert from "node:assert/strict";
import test from "node:test";

import { formatNewItemListPriceDisplay, normalizeNewItemListPrice } from "./newItemListPrice";

test("normalizeNewItemListPrice trims empty", () => {
  assert.equal(normalizeNewItemListPrice(" 12.99 "), "12.99");
  assert.equal(normalizeNewItemListPrice(""), undefined);
});

test("formatNewItemListPriceDisplay adds dollar sign", () => {
  assert.equal(formatNewItemListPriceDisplay("12.99"), "$12.99");
  assert.equal(formatNewItemListPriceDisplay("$12.99"), "$12.99");
});
