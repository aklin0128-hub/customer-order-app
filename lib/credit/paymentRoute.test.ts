import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("deposit slip stays on /payment and sales credit request lives on /credit", () => {
  const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const paymentPage = readFileSync(new URL("../../app/payment/page.tsx", import.meta.url), "utf8");
  const creditPage = readFileSync(new URL("../../app/credit/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(nextConfig, /source:\s*"\/credit"/);
  assert.match(paymentPage, /open \/payment/);
  assert.match(creditPage, /open \/credit/);
  assert.match(creditPage, /Sales Credit Request/);
  assert.equal(existsSync(new URL("../../app/credit/CreditRequestClient.tsx", import.meta.url)), true);
});
