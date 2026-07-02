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

test("scoreCatalogSearchQuery matches single-letter brand and name prefixes", () => {
  const item: CatalogItem = {
    sku: "99100",
    name: "ORANGE JUICE DRINK",
    brand: "ORION",
  };
  assert.equal(scoreCatalogSearchQuery(item, "o"), 600);
  assert.ok(scoreCatalogSearchQuery({ sku: "99200", name: "OIL NOODLE", brand: "ABC" }, "o") >= 550);
  assert.equal(scoreCatalogSearchQuery({ sku: "99300", name: "MILK", brand: "ABC" }, "o"), -1);
});

test("scoreCatalogSearchQuery matches two-letter name and brand substrings", () => {
  const item: CatalogItem = {
    sku: "99400",
    name: "GREEN TEA",
    brand: "NONGSHIM",
  };
  assert.equal(scoreCatalogSearchQuery(item, "gr"), 580);
  assert.equal(scoreCatalogSearchQuery(item, "ng"), 530);
});

test("scoreCatalogSearchQuery ignores punctuation and spaces in queries", () => {
  const item: CatalogItem = {
    sku: "88100",
    name: "O!TUBE NOODLE",
    brand: "NONGSHIM",
  };
  assert.ok(scoreCatalogSearchQuery(item, "o!tube") >= 560);
  assert.ok(scoreCatalogSearchQuery(item, "o tube") >= 540);
  assert.ok(scoreCatalogSearchQuery(item, "otube") >= 560);
  assert.ok(scoreCatalogSearchQuery(item, "o-tube") >= 560);
});
