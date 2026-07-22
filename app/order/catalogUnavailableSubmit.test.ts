import test from "node:test";
import assert from "node:assert/strict";

import { replaceCatalog } from "./catalogState";
import {
  formatOrderNotAvailableMessage,
  getUnavailableSubmitLines,
} from "./catalogUtils";

test("getUnavailableSubmitLines flags discontinued, ready-to-order, and missing SKUs", () => {
  replaceCatalog([
    { sku: "OK1", status: "NORMAL", name: "Ok" },
    { sku: "DISC1", status: "DISCONTINUED", name: "Gone" },
    { sku: "TBD1", status: "TBD", name: "Soon" },
    { sku: "RTO1", status: "READYTOORDER", name: "Not yet" },
    { sku: "NOBR1", status: "NORMAL_NOBR", name: "Ok nobr" },
  ] as any);

  const unavailable = getUnavailableSubmitLines([
    { sku: "OK1", qty: "2" },
    { sku: "DISC1", qty: "1" },
    { sku: "MISSING", qty: "3" },
    { sku: "TBD1", qty: "1" },
    { sku: "RTO1", qty: "1" },
    { sku: "NOBR1", qty: "1" },
  ]);

  assert.deepEqual(
    unavailable.map((item) => ({ sku: item.sku, status: item.status })),
    [
      { sku: "DISC1", status: "DISCONTINUED" },
      { sku: "MISSING", status: "NOT FOUND" },
      { sku: "RTO1", status: "READYTOORDER" },
    ]
  );
});

test("formatOrderNotAvailableMessage always includes sku when present", () => {
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
    formatOrderNotAvailableMessage("RTO1", "READYTOORDER", t),
    "RTO1 status is READYTOORDER."
  );
  assert.equal(
    formatOrderNotAvailableMessage("MISSING", "NOT FOUND", t),
    "MISSING was not found in the catalog."
  );
  assert.equal(
    formatOrderNotAvailableMessage("X1", undefined, t),
    "X1 status is UNAVAILABLE."
  );
});
