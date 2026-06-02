import assert from "node:assert/strict";
import test from "node:test";

import {
  compareCatalogByNewestImport,
  getNewItemAddedAtMs,
} from "./catalogNewItems";

test("getNewItemAddedAtMs prefers newSince over importedAt", () => {
  assert.equal(
    getNewItemAddedAtMs({
      newSince: "2026-03-01T00:00:00.000Z",
      importedAt: "2026-01-01T00:00:00.000Z",
    }),
    Date.parse("2026-03-01T00:00:00.000Z")
  );
});

test("compareCatalogByNewestImport sorts newest add date first", () => {
  const items = [
    { sku: "A", importedAt: "2026-01-01T00:00:00.000Z" },
    { sku: "B", importedAt: "2026-03-01T00:00:00.000Z" },
    { sku: "C", importedAt: "2026-02-01T00:00:00.000Z" },
  ];
  const sorted = [...items].sort(compareCatalogByNewestImport);
  assert.deepEqual(sorted.map((item) => item.sku), ["B", "C", "A"]);
});
