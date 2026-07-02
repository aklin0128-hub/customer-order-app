import assert from "node:assert/strict";
import test from "node:test";

import { parsePromotionSkuList } from "./promotions";

test("parsePromotionSkuList splits newlines and commas", () => {
  assert.deepEqual(parsePromotionSkuList("00100\n00200, 00300"), ["00100", "00200", "00300"]);
});

test("parsePromotionSkuList dedupes and uppercases", () => {
  assert.deepEqual(parsePromotionSkuList("abc123, ABC123; def456"), ["ABC123", "DEF456"]);
});
