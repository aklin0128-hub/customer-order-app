import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("public deposit-slip URL is /payment with /credit redirect", () => {
  const nextConfig = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../../app/payment/page.tsx", import.meta.url), "utf8");
  const client = readFileSync(new URL("../../app/payment/CreditClient.tsx", import.meta.url), "utf8");

  assert.match(nextConfig, /source:\s*"\/credit"/);
  assert.match(nextConfig, /destination:\s*"\/payment"/);
  assert.match(page, /open \/payment/);
  assert.match(page, />\/payment</);
  assert.doesNotMatch(page, /open \/credit/);
  assert.match(client, /reopen \/payment/);
  assert.doesNotMatch(client, /reopen \/credit/);
});
