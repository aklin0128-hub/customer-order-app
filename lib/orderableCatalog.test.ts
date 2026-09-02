import assert from "node:assert/strict";
import test from "node:test";

import {
  isCustomerVisibleCatalogStatus,
  isDiscontinuedStatus,
  isOrderableCatalogStatus,
  isReadyToOrderStatus,
  isSeasonalStatus,
} from "./orderableCatalog";

test("NORMAL* and TBD are orderable; READYTOORDER is not", () => {
  assert.equal(isOrderableCatalogStatus("NORMAL"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL_NOBR"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL_NBR"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL NOBR"), true);
  assert.equal(isOrderableCatalogStatus("normal"), true);
  assert.equal(isOrderableCatalogStatus("TBD"), true);
  assert.equal(isOrderableCatalogStatus("SEASONAL"), true);

  assert.equal(isOrderableCatalogStatus("READYTOORDER"), false);
  assert.equal(isOrderableCatalogStatus("DISCONTINUED"), false);
  assert.equal(isOrderableCatalogStatus("ABNORMAL"), false);
  assert.equal(isOrderableCatalogStatus(""), false);
  assert.equal(isOrderableCatalogStatus(undefined), false);
});

test("READYTOORDER and SEASONAL are hidden from Catalog browsing", () => {
  assert.equal(isReadyToOrderStatus("READYTOORDER"), true);
  assert.equal(isReadyToOrderStatus("Ready to Order"), true);
  assert.equal(isSeasonalStatus("SEASONAL"), true);
  assert.equal(isSeasonalStatus("Seasonal"), true);
  assert.equal(isCustomerVisibleCatalogStatus("READYTOORDER"), false);
  assert.equal(isCustomerVisibleCatalogStatus("SEASONAL"), false);
  assert.equal(isCustomerVisibleCatalogStatus("NORMAL"), true);
  assert.equal(isCustomerVisibleCatalogStatus("TBD"), true);
  assert.equal(isOrderableCatalogStatus("SEASONAL"), true);
});

test("DISCONTINUED matches spaced or underscored status", () => {
  assert.equal(isDiscontinuedStatus("DISCONTINUED"), true);
  assert.equal(isDiscontinuedStatus("Discontinued"), true);
  assert.equal(isDiscontinuedStatus("DISCONTINUED "), true);
  assert.equal(isDiscontinuedStatus("NORMAL"), false);
});
