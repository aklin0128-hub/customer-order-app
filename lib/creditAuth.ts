import { NextResponse } from "next/server";

import { getAdminPassword } from "@/lib/adminAuth";

/** Accepted passwords for /payment and /credit. Defaults keep 536678. */
const DEFAULT_CREDIT_PASSWORDS = ["536678"];

export function getCreditAccessPasswords(): string[] {
  const passwords = new Set(DEFAULT_CREDIT_PASSWORDS);

  const fromEnv = process.env.CREDIT_ACCESS_PASSWORD || "";
  for (const part of fromEnv.split(",")) {
    const trimmed = part.trim();
    if (trimmed) passwords.add(trimmed);
  }

  passwords.add(getAdminPassword());

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
  const credit = req.headers.get("x-credit-password") || "";
  const admin = req.headers.get("x-admin-password") || "";
  return isValidCreditPassword(credit) || isValidCreditPassword(admin);
}

export function creditUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireCredit(req: Request): NextResponse | null {
  if (checkCreditRequest(req)) return null;
  return creditUnauthorizedResponse();
}
