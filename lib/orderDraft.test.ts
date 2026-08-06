import assert from "node:assert/strict";
import { test } from "node:test";

import {
  aggregateDeviceCarts,
  buildCatalogQtyMapFromDraft,
  countDraftItems,
  deviceQtyForSharedTotal,
  mergeOrderDrafts,
  resolveCloudDraftSave,
  resolveCollaborativeCloudSave,
  resolveItemAddedAt,
  syncItemAddedAt,
} from "@/lib/orderDraft";

test("collaborative aggregate sums the same SKU across devices", () => {
  const aggregate = aggregateDeviceCarts({
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
      B: { catalogQtyMap: { RICE: "1", WINE: "1" }, updatedAt: "2026-08-05T01:01:00.000Z" },
    },
  });

  assert.deepEqual(aggregate, {
    RICE: "2",
    NOODLE: "1",
    WINE: "1",
  });
});

test("deviceQtyForSharedTotal only stores this device's share", () => {
  const draft = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
      B: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T01:01:00.000Z" },
    },
  };

  assert.equal(deviceQtyForSharedTotal(draft, "A", "RICE", 2), 1);
  assert.equal(deviceQtyForSharedTotal(draft, "A", "RICE", 3), 2);
  assert.equal(deviceQtyForSharedTotal(draft, "A", "RICE", 1), 0);
});

test("resolveCollaborativeCloudSave merges two device carts by sum", () => {
  const existing = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1", NOODLE: "1" },
    updatedAt: "2026-08-05T01:00:00.000Z",
  };

  const resolved = resolveCollaborativeCloudSave({
    incoming: {
      accountNo: "FL111",
      catalogQtyMap: { RICE: "2", NOODLE: "1", WINE: "1" },
      updatedAt: "2026-08-05T01:02:00.000Z",
    },
    existing,
    allowClear: false,
    deviceId: "B",
    deviceQtyMap: { RICE: "1", WINE: "1" },
  });

  assert.notEqual(resolved, "delete");
  assert.deepEqual(buildCatalogQtyMapFromDraft(resolved), {
    RICE: "2",
    NOODLE: "1",
    WINE: "1",
  });
});

test("resolveCollaborativeCloudSave tombstones removed SKUs for all devices", () => {
  const existing = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
      B: { catalogQtyMap: { RICE: "1", WINE: "1" }, updatedAt: "2026-08-05T01:01:00.000Z" },
    },
    catalogQtyMap: { RICE: "2", NOODLE: "1", WINE: "1" },
    updatedAt: "2026-08-05T01:01:00.000Z",
  };

  const resolved = resolveCollaborativeCloudSave({
    incoming: {
      accountNo: "FL111",
      catalogQtyMap: { RICE: "2", WINE: "1" },
      updatedAt: "2026-08-05T01:03:00.000Z",
    },
    existing,
    allowClear: false,
    deviceId: "A",
    deviceQtyMap: { RICE: "1" },
  });

  assert.notEqual(resolved, "delete");
  assert.deepEqual(buildCatalogQtyMapFromDraft(resolved), {
    RICE: "2",
    WINE: "1",
  });
  assert.ok(resolved.removedSkus?.NOODLE);
});

test("mergeOrderDrafts keeps both device slices so reload does not double-count", () => {
  const local = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1", NOODLE: "1" },
    updatedAt: "2026-08-05T01:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
      B: { catalogQtyMap: { RICE: "1", WINE: "1" }, updatedAt: "2026-08-05T01:01:00.000Z" },
    },
    catalogQtyMap: { RICE: "2", NOODLE: "1", WINE: "1" },
    updatedAt: "2026-08-05T01:01:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.deepEqual(buildCatalogQtyMapFromDraft(merged), {
    RICE: "2",
    NOODLE: "1",
    WINE: "1",
  });
});

test("resolveCloudDraftSave replaces cloud with newer non-empty incoming (removals stick)", () => {
  const incoming = {
    accountNo: "FL111",
    catalogQtyMap: { "00300": "3" },
    updatedAt: "2026-05-20T12:00:00.000Z",
  };
  const existing = {
    accountNo: "FL111",
    catalogQtyMap: { "00100": "2", "00300": "1" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  const resolved = resolveCloudDraftSave(incoming, existing, false);
  assert.notEqual(resolved, "delete");
  assert.deepEqual(buildCatalogQtyMapFromDraft(resolved), { "00300": "3" });
});

test("resolveCloudDraftSave deletes only on explicit clear", () => {
  const incoming = {
    accountNo: "FL111",
    catalogQtyMap: {},
    updatedAt: "2026-05-20T12:00:00.000Z",
  };
  const existing = {
    accountNo: "FL111",
    catalogQtyMap: { "00100": "2" },
    updatedAt: "2026-05-20T11:00:00.000Z",
  };

  assert.equal(resolveCloudDraftSave(incoming, existing, true), "delete");
});

test("resolveCollaborativeCloudSave stamps first-added time for new SKUs", () => {
  const existing = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1" },
    itemAddedAt: { RICE: "2026-08-05T01:00:00.000Z" },
    updatedAt: "2026-08-05T01:00:00.000Z",
  };

  const resolved = resolveCollaborativeCloudSave({
    incoming: {
      accountNo: "FL111",
      catalogQtyMap: { RICE: "1", WINE: "1" },
      updatedAt: "2026-08-05T02:00:00.000Z",
    },
    existing,
    allowClear: false,
    deviceId: "A",
    deviceQtyMap: { RICE: "1", WINE: "1" },
  });

  assert.notEqual(resolved, "delete");
  assert.equal(resolved.itemAddedAt?.RICE, "2026-08-05T01:00:00.000Z");
  assert.equal(resolved.itemAddedAt?.WINE, "2026-08-05T02:00:00.000Z");
});

test("resolveCollaborativeCloudSave clears addedAt when SKU removed and restamps on re-add", () => {
  const existing = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1", NOODLE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1", NOODLE: "1" },
    itemAddedAt: {
      RICE: "2026-08-05T01:00:00.000Z",
      NOODLE: "2026-08-05T01:00:00.000Z",
    },
    updatedAt: "2026-08-05T01:00:00.000Z",
  };

  const afterRemove = resolveCollaborativeCloudSave({
    incoming: {
      accountNo: "FL111",
      catalogQtyMap: { RICE: "1" },
      updatedAt: "2026-08-05T02:00:00.000Z",
    },
    existing,
    allowClear: false,
    deviceId: "A",
    deviceQtyMap: { RICE: "1" },
  });

  assert.notEqual(afterRemove, "delete");
  assert.equal(afterRemove.itemAddedAt?.NOODLE, undefined);

  const afterReadd = resolveCollaborativeCloudSave({
    incoming: {
      accountNo: "FL111",
      catalogQtyMap: { RICE: "1", NOODLE: "1" },
      updatedAt: "2026-08-05T03:00:00.000Z",
    },
    existing: afterRemove,
    allowClear: false,
    deviceId: "A",
    deviceQtyMap: { RICE: "1", NOODLE: "1" },
  });

  assert.notEqual(afterReadd, "delete");
  assert.equal(afterReadd.itemAddedAt?.NOODLE, "2026-08-05T03:00:00.000Z");
  assert.equal(afterReadd.itemAddedAt?.RICE, "2026-08-05T01:00:00.000Z");
});

test("mergeOrderDrafts keeps the earliest itemAddedAt", () => {
  const local = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1" },
    itemAddedAt: { RICE: "2026-08-05T01:00:00.000Z" },
    updatedAt: "2026-08-05T01:00:00.000Z",
  };
  const cloud = {
    accountNo: "FL111",
    deviceCarts: {
      B: { catalogQtyMap: { RICE: "1", WINE: "1" }, updatedAt: "2026-08-05T02:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "1", WINE: "1" },
    itemAddedAt: {
      RICE: "2026-08-05T01:30:00.000Z",
      WINE: "2026-08-05T02:00:00.000Z",
    },
    updatedAt: "2026-08-05T02:00:00.000Z",
  };

  const merged = mergeOrderDrafts(local, cloud);
  assert.equal(merged?.itemAddedAt?.RICE, "2026-08-05T01:00:00.000Z");
  assert.equal(merged?.itemAddedAt?.WINE, "2026-08-05T02:00:00.000Z");
});

test("resolveItemAddedAt falls back to earliest device slice for legacy drafts", () => {
  const draft = {
    accountNo: "FL111",
    deviceCarts: {
      A: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T03:00:00.000Z" },
      B: { catalogQtyMap: { RICE: "1" }, updatedAt: "2026-08-05T01:00:00.000Z" },
    },
    catalogQtyMap: { RICE: "2" },
    updatedAt: "2026-08-05T03:00:00.000Z",
  };

  assert.equal(resolveItemAddedAt(draft, "RICE"), "2026-08-05T01:00:00.000Z");
});

test("syncItemAddedAt keeps existing stamps and stamps only new SKUs", () => {
  const stamped = syncItemAddedAt({
    previousQtyMap: { RICE: "1" },
    nextQtyMap: { RICE: "1", WINE: "2" },
    previousAddedAt: { RICE: "2026-08-05T01:00:00.000Z" },
    now: "2026-08-05T04:00:00.000Z",
    fallbackAt: "2026-08-05T00:00:00.000Z",
  });

  assert.deepEqual(stamped, {
    RICE: "2026-08-05T01:00:00.000Z",
    WINE: "2026-08-05T04:00:00.000Z",
  });
});

test("buildCatalogQtyMapFromDraft uses cart lines when catalogQtyMap is empty", () => {
  const map = buildCatalogQtyMapFromDraft({
    cart: [{ sku: "0013d", qty: "2" }],
    catalogQtyMap: {},
  });
  assert.deepEqual(map, { "0013D": "2" });
  assert.equal(countDraftItems({ cart: [{ sku: "0013d", qty: "2" }], catalogQtyMap: {} }), 1);
});
