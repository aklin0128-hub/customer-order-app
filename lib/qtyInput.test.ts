import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeQtyInput } from "./qtyInput";

test("sanitizeQtyInput keeps digits and ignores letter-only input", () => {
  assert.deepEqual(sanitizeQtyInput("5"), { qty: "5", ignore: false });
  assert.deepEqual(sanitizeQtyInput("5abc"), { qty: "5", ignore: false });
  assert.deepEqual(sanitizeQtyInput("abc"), { qty: "", ignore: true });
  assert.deepEqual(sanitizeQtyInput(""), { qty: "", ignore: false });
  assert.deepEqual(sanitizeQtyInput("  "), { qty: "", ignore: false });
});
