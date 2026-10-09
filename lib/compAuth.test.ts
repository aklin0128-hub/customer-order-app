import assert from "node:assert/strict";
import test from "node:test";

import { getCompAccessPasswords, isValidCompPassword } from "./compAuth";

test("comp auth accepts default 536678 without env", () => {
  const prevComp = process.env.COMP_ACCESS_PASSWORD;
  const prevAdmin = process.env.ADMIN_PASSWORD;
  delete process.env.COMP_ACCESS_PASSWORD;
  delete process.env.ADMIN_PASSWORD;

  try {
    assert.ok(getCompAccessPasswords().includes("536678"));
    assert.equal(isValidCompPassword("536678"), true);
    assert.equal(isValidCompPassword("wrong"), false);
    assert.equal(isValidCompPassword(""), false);
  } finally {
    if (prevComp === undefined) delete process.env.COMP_ACCESS_PASSWORD;
    else process.env.COMP_ACCESS_PASSWORD = prevComp;
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
  }
});

test("comp auth accepts COMP_ACCESS_PASSWORD and ADMIN_PASSWORD", () => {
  const prevComp = process.env.COMP_ACCESS_PASSWORD;
  const prevAdmin = process.env.ADMIN_PASSWORD;
  process.env.COMP_ACCESS_PASSWORD = "extra1,extra2";
  process.env.ADMIN_PASSWORD = "admin-only";

  try {
    assert.equal(isValidCompPassword("536678"), true);
    assert.equal(isValidCompPassword("extra1"), true);
    assert.equal(isValidCompPassword("extra2"), true);
    assert.equal(isValidCompPassword("admin-only"), true);
  } finally {
    if (prevComp === undefined) delete process.env.COMP_ACCESS_PASSWORD;
    else process.env.COMP_ACCESS_PASSWORD = prevComp;
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
  }
});
