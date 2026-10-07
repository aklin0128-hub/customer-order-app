import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import {
  catalogColumnCountForWidth,
  catalogColGapPx,
  catalogRowEstimatePx,
  catalogRowGapPx,
  catalogVirtualRowKey,
  CATALOG_ROW_GAP_PX,
} from "./catalogGridLayout";

const here = dirname(fileURLToPath(import.meta.url));
const orderPageSrc = readFileSync(join(here, "page.tsx"), "utf8");
const orderCss = readFileSync(join(here, "order.css"), "utf8");
const orderStylesSrc = readFileSync(join(here, "orderStyles.ts"), "utf8");
const virtualGridSrc = readFileSync(join(here, "components/CatalogVirtualGrid.tsx"), "utf8");

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

test("catalogVirtualRowKey changes when a search replaces row SKUs", () => {
  const all = [{ sku: "00001" }, { sku: "00002" }, { sku: "00003" }, { sku: "00004" }];
  const melon = [{ sku: "11026K" }, { sku: "05501" }];
  assert.equal(catalogVirtualRowKey(all, 0, 2), "0:00001|00002");
  assert.equal(catalogVirtualRowKey(melon, 0, 2), "0:11026K|05501");
  assert.notEqual(catalogVirtualRowKey(all, 0, 2), catalogVirtualRowKey(melon, 0, 2));
});

test("two-column row estimate leaves room for a full catalog card", () => {
  assert.ok(catalogRowEstimatePx(2) >= 400);
});

test("catalog virtual scroll box defaults to the max viewport slot", () => {
  assert.match(
    orderCss,
    /\.order-catalog-virtual-scroll\s*\{[^}]*min-height:\s*calc\(100dvh - 220px\)/
  );
  assert.match(
    orderCss,
    /\.order-catalog-virtual-scroll\s*\{[^}]*height:\s*calc\(100dvh - 220px\)/
  );
  assert.match(
    orderCss,
    /\.order-page--mobile-shop \.order-catalog-virtual-scroll\s*\{[^}]*min-height:\s*calc\(100dvh - 156px\)/
  );
  assert.match(orderStylesSrc, /export const catalogVirtualScrollStyle/);
  assert.doesNotMatch(orderStylesSrc, /catalogVirtualScrollStyle[\s\S]*maxHeight:/);
});

test("catalog virtual grid remounts and rekeys when search results change", () => {
  assert.match(virtualGridSrc, /key=\{props\.gridKey \|\| "catalog"\}/);
  assert.match(virtualGridSrc, /getItemKey:\s*\(index\)\s*=>\s*catalogVirtualRowKey/);
  assert.match(orderPageSrc, /gridKey=\{`catalog:/);
});
