import { NextResponse } from "next/server";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "536678";
}

export function checkAdminRequest(req: Request) {
  return (req.headers.get("x-admin-password") || "") === getAdminPassword();
}

export function adminUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireAdmin(req: Request): NextResponse | null {
  if (checkAdminRequest(req)) return null;
  return adminUnauthorizedResponse();
}

/** Optional cron / snapshot trigger via ?secret= or x-cron-secret header */
export function checkCronSecret(req: Request) {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret") || "";
  const fromHeader = req.headers.get("x-cron-secret") || "";
  return fromQuery === expected || fromHeader === expected;
}
