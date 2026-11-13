import assert from "node:assert/strict";
import test from "node:test";

import { pickProductSheetGrid } from "./productSheetPdf";

test("pickProductSheetGrid densifies to stay within about 3 pages", () => {
  assert.deepEqual(pickProductSheetGrid(10), { cols: 4, rows: 3 });
  assert.deepEqual(pickProductSheetGrid(36), { cols: 4, rows: 3 }); // 12*3
  assert.deepEqual(pickProductSheetGrid(37), { cols: 4, rows: 4 }); // need 16/page
  assert.deepEqual(pickProductSheetGrid(48), { cols: 4, rows: 4 });
  assert.deepEqual(pickProductSheetGrid(49), { cols: 5, rows: 4 }); // need 20/page
  assert.deepEqual(pickProductSheetGrid(60), { cols: 5, rows: 4 });
  assert.deepEqual(pickProductSheetGrid(61), { cols: 5, rows: 5 }); // need 25/page
});
