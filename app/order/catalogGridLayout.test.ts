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
  measureCatalogVirtualRow,
  CATALOG_ROW_GAP_PX,
  CATALOG_SCROLL_MIN_HEIGHT_PX,
  CATALOG_VIRTUAL_OVERSCAN,
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

test("two-column mobile estimate stays near a compact card", () => {
  assert.ok(catalogRowEstimatePx(2) >= 300);
  assert.ok(catalogRowEstimatePx(2) <= 330);
  assert.equal(catalogRowEstimatePx(2), 312);
});

test("wide desktop estimates stay tall enough to avoid overlap", () => {
  assert.ok(catalogRowEstimatePx(12) >= 360);
  assert.ok(catalogRowEstimatePx(14) >= 360);
});

test("measureCatalogVirtualRow uses overflowing card height", () => {
  const row = {
    scrollHeight: 290,
    offsetHeight: 290,
    children: [
      { scrollHeight: 290, offsetHeight: 290 },
      { scrollHeight: 388, offsetHeight: 290 },
    ],
  };
  assert.equal(measureCatalogVirtualRow(row), 388);
});

test("measureCatalogVirtualRow ignores a stretched row minHeight", () => {
  const row = {
    scrollHeight: 420,
    offsetHeight: 420,
    children: [
      { scrollHeight: 312, offsetHeight: 312 },
      { scrollHeight: 300, offsetHeight: 300 },
    ],
  };
  assert.equal(measureCatalogVirtualRow(row), 312);
});

test("catalog virtual overscan stays low so a wide grid does not mount too many cards", () => {
  assert.equal(CATALOG_VIRTUAL_OVERSCAN, 2);
  assert.match(virtualGridSrc, /overscan:\s*CATALOG_VIRTUAL_OVERSCAN/);
  assert.doesNotMatch(virtualGridSrc, /items\.map\(\(item\) => String\(item\.sku/);
});

test("catalog virtual scroll box fills remaining viewport for a one-row search", () => {
  assert.equal(CATALOG_SCROLL_MIN_HEIGHT_PX, 400);
  assert.match(
    orderCss,
    /\.order-shop-card--listing:has\(\.order-catalog-virtual-scroll\)\s*\{[^}]*flex:\s*1 1 auto/
  );
  assert.match(
    orderCss,
    /\.order-catalog-virtual-scroll\s*\{[^}]*flex:\s*1 1 auto/
  );
  assert.match(
    orderCss,
    /\.order-catalog-virtual-scroll\s*\{[^}]*min-height:\s*400px/
  );
  assert.match(virtualGridSrc, /minHeight:\s*"100%"/);
  assert.match(orderStylesSrc, /export const catalogVirtualScrollStyle/);
  assert.doesNotMatch(orderStylesSrc, /catalogVirtualScrollStyle[\s\S]*maxHeight:/);
});

test("catalog virtual grid remounts and rekeys when search results change", () => {
  assert.match(virtualGridSrc, /key=\{props\.gridKey \|\| "catalog"\}/);
  assert.match(virtualGridSrc, /getItemKey:\s*\(index\)\s*=>\s*catalogVirtualRowKey/);
  assert.match(virtualGridSrc, /measureCatalogVirtualRow/);
  assert.match(orderPageSrc, /gridKey=\{`catalog:/);
  assert.match(orderPageSrc, /const favoriteCardProps = useCallback/);
  assert.match(
    orderCss,
    /\.order-catalog-virtual-row \.catalog-qty-card\s*\{[^}]*height:\s*auto/
  );
  assert.doesNotMatch(virtualGridSrc, /minHeight:\s*vr\.size/);
});
