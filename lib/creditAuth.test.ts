import assert from "node:assert/strict";
import test from "node:test";

import { checkCreditRequest, getCreditAccessPasswords, isValidCreditPassword } from "./creditAuth";

function withEnv(values: { admin?: string; credit?: string; comp?: string }, fn: () => void) {
  const prevAdmin = process.env.ADMIN_PASSWORD;
  const prevCredit = process.env.CREDIT_ACCESS_PASSWORD;
  const prevComp = process.env.COMP_ACCESS_PASSWORD;
  try {
    if (values.admin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = values.admin;
    if (values.credit === undefined) delete process.env.CREDIT_ACCESS_PASSWORD;
    else process.env.CREDIT_ACCESS_PASSWORD = values.credit;
    if (values.comp === undefined) delete process.env.COMP_ACCESS_PASSWORD;
    else process.env.COMP_ACCESS_PASSWORD = values.comp;
    fn();
  } finally {
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
    if (prevCredit === undefined) delete process.env.CREDIT_ACCESS_PASSWORD;
    else process.env.CREDIT_ACCESS_PASSWORD = prevCredit;
    if (prevComp === undefined) delete process.env.COMP_ACCESS_PASSWORD;
    else process.env.COMP_ACCESS_PASSWORD = prevComp;
  }
}

test("credit auth accepts default 536678 without env", () => {
  withEnv({}, () => {
    assert.ok(getCreditAccessPasswords().includes("536678"));
    assert.equal(isValidCreditPassword("536678"), true);
    assert.equal(isValidCreditPassword("wrong"), false);
    assert.equal(isValidCreditPassword(""), false);
  });
});

test("credit auth always accepts ADMIN_PASSWORD", () => {
  withEnv({ admin: "admin-only", credit: "extra1,extra2" }, () => {
    assert.equal(isValidCreditPassword("536678"), true);
    assert.equal(isValidCreditPassword("extra1"), true);
    assert.equal(isValidCreditPassword("extra2"), true);
    assert.equal(isValidCreditPassword("admin-only"), true);
  });
});

test("credit APIs accept x-admin-password or x-credit-password", () => {
  withEnv({ admin: "admin-only" }, () => {
    const adminReq = new Request("http://local/api/credit/parse", {
      headers: { "x-admin-password": "admin-only" },
    });
    const creditReq = new Request("http://local/api/credit/parse", {
      headers: { "x-credit-password": "536678" },
    });
    const badReq = new Request("http://local/api/credit/parse", {
      headers: { "x-admin-password": "nope" },
    });
    assert.equal(checkCreditRequest(adminReq), true);
    assert.equal(checkCreditRequest(creditReq), true);
    assert.equal(checkCreditRequest(badReq), false);
  });
});
