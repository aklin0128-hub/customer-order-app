import test from "node:test";
import assert from "node:assert/strict";

import { replaceCatalog } from "./catalogState";
import {
  formatOrderNotAvailableMessage,
  getUnavailableSubmitLines,
} from "./catalogUtils";

test("getUnavailableSubmitLines flags discontinued and missing SKUs", () => {
  replaceCatalog([
    { sku: "OK1", status: "NORMAL", name: "Ok" },
    { sku: "DISC1", status: "DISCONTINUED", name: "Gone" },
    { sku: "TBD1", status: "TBD", name: "Soon" },
  ] as any);

  const unavailable = getUnavailableSubmitLines([
    { sku: "OK1", qty: "2" },
    { sku: "DISC1", qty: "1" },
    { sku: "MISSING", qty: "3" },
    { sku: "TBD1", qty: "1" },
  ]);

  assert.deepEqual(
    unavailable.map((item) => ({ sku: item.sku, status: item.status })),
    [
      { sku: "DISC1", status: "DISCONTINUED" },
      { sku: "MISSING", status: "NOT FOUND" },
    ]
  );
});

test("formatOrderNotAvailableMessage includes sku and status", () => {
  const t = {
    orderNotAvailable: "Not available",
    statusWarning: "{sku} status is {status}.",
    unavailableMissingSku: "{sku} was not found in the catalog.",
  };
  assert.equal(
    formatOrderNotAvailableMessage("DISC1", "DISCONTINUED", t),
    "DISC1 status is DISCONTINUED."
  );
  assert.equal(
    formatOrderNotAvailableMessage("MISSING", undefined, t),
    "MISSING was not found in the catalog."
  );
});
