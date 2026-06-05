import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogItemMatchesScanCode,
  normalizeUpcScanCode,
  scoreCatalogSearchQuery,
} from "../app/order/catalogUtils";
import type { CatalogItem } from "../app/order/types";

const sample: CatalogItem = {
  sku: "00100",
  name: "Sample",
  brand: "BRAND",
  upc: "081652000020",
};

test("normalizeUpcScanCode pads short scanner input", () => {
  assert.equal(normalizeUpcScanCode("81652000020"), "081652000020");
});

test("catalogItemMatchesScanCode matches stored UPC without leading zero input", () => {
  assert.equal(catalogItemMatchesScanCode(sample, "81652000020"), true);
  assert.equal(catalogItemMatchesScanCode(sample, "081652000020"), true);
});

test("scoreCatalogSearchQuery ranks exact UPC highly", () => {
  assert.equal(scoreCatalogSearchQuery(sample, "81652000020"), 850);
});
