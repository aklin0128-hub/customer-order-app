import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import {
  catalogColumnCountForWidth,
  catalogColGapPx,
  catalogRowGapPx,
  CATALOG_ROW_GAP_PX,
} from "./catalogGridLayout";

const orderPageSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
  "utf8"
);

test("catalog rows use a fixed vertical gap", () => {
  assert.equal(CATALOG_ROW_GAP_PX, 20);
  assert.equal(catalogRowGapPx(), 20);
  assert.equal(catalogColGapPx(), 4);
});

test("column count scales with container width", () => {
  assert.equal(catalogColumnCountForWidth(320), 2);
  assert.ok(catalogColumnCountForWidth(800) >= 4);
  assert.ok(catalogColumnCountForWidth(1280) >= 7);
  assert.ok(catalogColumnCountForWidth(1920) >= 10);
  assert.ok(catalogColumnCountForWidth(1920) <= 14);
});

test("catalog order lists items through the virtual grid", () => {
  assert.match(orderPageSrc, /<CatalogVirtualGrid[\s\S]*items=\{orderableCatalogItems\}/);
  assert.doesNotMatch(orderPageSrc, /orderableCatalogItems\.map\(/);
});
