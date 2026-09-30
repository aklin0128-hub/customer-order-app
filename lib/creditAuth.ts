import { NextResponse } from "next/server";

/** Accepted passwords for /credit. Defaults keep 536678. */
const DEFAULT_CREDIT_PASSWORDS = ["536678"];

export function getCreditAccessPasswords(): string[] {
  const passwords = new Set(DEFAULT_CREDIT_PASSWORDS);

  const fromEnv = process.env.CREDIT_ACCESS_PASSWORD || "";
  for (const part of fromEnv.split(",")) {
    const trimmed = part.trim();
    if (trimmed) passwords.add(trimmed);
  }

  const admin = String(process.env.ADMIN_PASSWORD || "").trim();
  if (admin) passwords.add(admin);

  // Reuse comp password when set so one shared ops password works.
  const comp = process.env.COMP_ACCESS_PASSWORD || "";
  for (const part of comp.split(",")) {
    const trimmed = part.trim();
    if (trimmed) passwords.add(trimmed);
  }

  return [...passwords];
}

export function isValidCreditPassword(password: string) {
  const trimmed = String(password || "").trim();
  return Boolean(trimmed) && getCreditAccessPasswords().includes(trimmed);
}

export function checkCreditRequest(req: Request) {
  return isValidCreditPassword(req.headers.get("x-credit-password") || "");
}

export function creditUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireCredit(req: Request): NextResponse | null {
  if (checkCreditRequest(req)) return null;
  return creditUnauthorizedResponse();
}
