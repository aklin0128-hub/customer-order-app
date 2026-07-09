import assert from "node:assert/strict";
import test from "node:test";

import {
  compareCatalogByNewestImport,
  compareCatalogForDisplay,
  formatNewItemComingDate,
  getNewItemAddedAtMs,
  parseNewPublishedDate,
} from "./catalogNewItems";

test("getNewItemAddedAtMs prefers newPublishedDate over newSince", () => {
  assert.equal(
    getNewItemAddedAtMs({
      newPublishedDate: "2026-04-01",
      newSince: "2026-03-01T00:00:00.000Z",
      importedAt: "2026-01-01T00:00:00.000Z",
    }),
    Date.parse("2026-04-01T12:00:00")
  );
});

test("getNewItemAddedAtMs prefers newSince over importedAt", () => {
  assert.equal(
    getNewItemAddedAtMs({
      newSince: "2026-03-01T00:00:00.000Z",
      importedAt: "2026-01-01T00:00:00.000Z",
    }),
    Date.parse("2026-03-01T00:00:00.000Z")
  );
});

test("formatNewItemComingDate formats YYYY-MM-DD", () => {
  assert.equal(formatNewItemComingDate("2026-07-15", "en")?.includes("2026"), true);
});

test("parseNewPublishedDate rejects invalid values", () => {
  assert.equal(parseNewPublishedDate("2026-05-20"), "2026-05-20");
  assert.equal(parseNewPublishedDate("20/05/2026"), undefined);
  assert.equal(parseNewPublishedDate(""), undefined);
});

test("compareCatalogForDisplay sorts by SKU only without justAdded pin", () => {
  const items = [
    { sku: "10495K", justAdded: true },
    { sku: "01020D" },
    { sku: "08180K", justAdded: true },
  ];
  const sorted = [...items].sort(compareCatalogForDisplay);
  assert.deepEqual(sorted.map((item) => item.sku), ["01020D", "08180K", "10495K"]);
});

test("compareCatalogByNewestImport: justAdded, then published date, then SKU", () => {
  const items = [
    { sku: "C", newPublishedDate: "2026-06-01" },
    { sku: "A", justAdded: true, newPublishedDate: "2026-05-01" },
    { sku: "B", justAdded: true, newPublishedDate: "2026-06-01" },
    { sku: "D", newPublishedDate: "2026-06-10" },
    { sku: "E", importedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const sorted = [...items].sort(compareCatalogByNewestImport);
  assert.deepEqual(sorted.map((item) => item.sku), ["B", "A", "D", "C", "E"]);
});
