import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clearPendingOrderIntent,
  consumePendingOrderIntent,
  queuePendingOrderSku,
  readPendingOrderIntent,
  savePendingOrderIntent,
} from "@/lib/pendingOrderIntent";

const memory = new Map<string, string>();

test("pending order intent queues and consumes SKUs", () => {
  memory.clear();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    get length() {
      return memory.size;
    },
  } as Storage;

  clearPendingOrderIntent();

  queuePendingOrderSku("rice", { qty: "1", mode: "promotion" });
  queuePendingOrderSku("rice", { qty: "1", mode: "promotion" });
  queuePendingOrderSku("wine", { qty: "1", mode: "promotion" });

  const pending = readPendingOrderIntent();
  assert.ok(pending);
  assert.equal(pending?.mode, "promotion");
  assert.deepEqual(pending?.skus, [
    { sku: "RICE", qty: "2" },
    { sku: "WINE", qty: "1" },
  ]);

  const consumed = consumePendingOrderIntent();
  assert.deepEqual(consumed?.skus.map((line) => line.sku), ["RICE", "WINE"]);
  assert.equal(readPendingOrderIntent(), null);

  savePendingOrderIntent({ skus: [{ sku: "noodle", qty: "3" }], mode: "newItems" });
  assert.equal(readPendingOrderIntent()?.mode, "newItems");
  clearPendingOrderIntent();
  assert.equal(readPendingOrderIntent(), null);
});
