import assert from "node:assert/strict";
import test from "node:test";

import { splitItemsAcrossTwoPages } from "./productSheetPdf";

test("splitItemsAcrossTwoPages splits evenly onto two pages", () => {
  assert.deepEqual(splitItemsAcrossTwoPages([]), []);
  assert.deepEqual(splitItemsAcrossTwoPages([1]), [[1]]);
  assert.deepEqual(splitItemsAcrossTwoPages([1, 2, 3, 4]), [
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(splitItemsAcrossTwoPages([1, 2, 3, 4, 5]), [
    [1, 2, 3],
    [4, 5],
  ]);
});
