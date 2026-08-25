import assert from "node:assert/strict";
import test from "node:test";

import {
  isCustomerVisibleCatalogStatus,
  isOrderableCatalogStatus,
  isReadyToOrderStatus,
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

test("READYTOORDER is hidden from customer catalog visibility", () => {
  assert.equal(isReadyToOrderStatus("READYTOORDER"), true);
  assert.equal(isReadyToOrderStatus("Ready to Order"), true);
  assert.equal(isCustomerVisibleCatalogStatus("READYTOORDER"), false);
  assert.equal(isCustomerVisibleCatalogStatus("NORMAL"), true);
  assert.equal(isCustomerVisibleCatalogStatus("TBD"), true);
});
