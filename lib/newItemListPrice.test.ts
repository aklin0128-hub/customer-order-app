import assert from "node:assert/strict";
import test from "node:test";

import { formatNewItemListPriceDisplay, normalizeNewItemListPrice } from "./newItemListPrice";

test("normalizeNewItemListPrice trims empty", () => {
  assert.equal(normalizeNewItemListPrice(" 12.99 "), "12.99");
  assert.equal(normalizeNewItemListPrice(""), undefined);
});

test("formatNewItemListPriceDisplay adds dollar sign and two decimals", () => {
  assert.equal(formatNewItemListPriceDisplay("12.99"), "$12.99");
  assert.equal(formatNewItemListPriceDisplay("$12.99"), "$12.99");
  assert.equal(formatNewItemListPriceDisplay("12"), "$12.00");
  assert.equal(formatNewItemListPriceDisplay("$12"), "$12.00");
  assert.equal(formatNewItemListPriceDisplay("12.9"), "$12.90");
  assert.equal(formatNewItemListPriceDisplay("1,234.5"), "$1234.50");
});
