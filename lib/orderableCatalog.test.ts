import assert from "node:assert/strict";
import test from "node:test";

import { isOrderableCatalogStatus } from "./orderableCatalog";

test("only NORMAL and NORMAL-* statuses are orderable", () => {
  assert.equal(isOrderableCatalogStatus("NORMAL"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL_NOBR"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL_NBR"), true);
  assert.equal(isOrderableCatalogStatus("NORMAL NOBR"), true);
  assert.equal(isOrderableCatalogStatus("normal"), true);

  assert.equal(isOrderableCatalogStatus("READYTOORDER"), false);
  assert.equal(isOrderableCatalogStatus("TBD"), false);
  assert.equal(isOrderableCatalogStatus("DISCONTINUED"), false);
  assert.equal(isOrderableCatalogStatus("ABNORMAL"), false);
  assert.equal(isOrderableCatalogStatus(""), false);
  assert.equal(isOrderableCatalogStatus(undefined), false);
});
