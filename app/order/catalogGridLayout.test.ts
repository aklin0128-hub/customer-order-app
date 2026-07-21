import test from "node:test";
import assert from "node:assert/strict";

import {
  catalogColumnCountForWidth,
  catalogGridGapPx,
  CATALOG_GRID_GAP_PX,
} from "./catalogGridLayout";

test("catalog row gap is half of the previous 8px default", () => {
  assert.equal(CATALOG_GRID_GAP_PX, 4);
  assert.equal(catalogGridGapPx(7), 4);
});

test("column count scales with container width", () => {
  assert.equal(catalogColumnCountForWidth(320), 2);
  assert.ok(catalogColumnCountForWidth(800) >= 4);
  assert.ok(catalogColumnCountForWidth(1280) >= 7);
  assert.ok(catalogColumnCountForWidth(1920) >= 10);
  assert.ok(catalogColumnCountForWidth(1920) <= 14);
});
