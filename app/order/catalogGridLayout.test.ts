import test from "node:test";
import assert from "node:assert/strict";

import {
  catalogColumnCountForWidth,
  catalogColGapPx,
  catalogRowGapPx,
  CATALOG_ROW_GAP_PX,
} from "./catalogGridLayout";

test("catalog rows use a fixed vertical gap", () => {
  assert.equal(CATALOG_ROW_GAP_PX, 12);
  assert.equal(catalogRowGapPx(), 12);
  assert.equal(catalogColGapPx(), 4);
});

test("column count scales with container width", () => {
  assert.equal(catalogColumnCountForWidth(320), 2);
  assert.ok(catalogColumnCountForWidth(800) >= 4);
  assert.ok(catalogColumnCountForWidth(1280) >= 7);
  assert.ok(catalogColumnCountForWidth(1920) >= 10);
  assert.ok(catalogColumnCountForWidth(1920) <= 14);
});
