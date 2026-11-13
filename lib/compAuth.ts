import { NextResponse } from "next/server";

/** Accepted passwords for /comp. Defaults keep 536678. */
const DEFAULT_COMP_PASSWORDS = ["536678"];

export function getCompAccessPasswords(): string[] {
  const passwords = new Set(DEFAULT_COMP_PASSWORDS);

  const fromEnv = process.env.COMP_ACCESS_PASSWORD || "";
  for (const part of fromEnv.split(",")) {
    const trimmed = part.trim();
    if (trimmed) passwords.add(trimmed);
  }

  const admin = String(process.env.ADMIN_PASSWORD || "").trim();
  if (admin) passwords.add(admin);

  return [...passwords];
}

/** @deprecated Prefer getCompAccessPasswords / isValidCompPassword */
export function getCompAccessPassword() {
  return getCompAccessPasswords()[0] || "536678";
}

export function isValidCompPassword(password: string) {
  const trimmed = String(password || "").trim();
  return Boolean(trimmed) && getCompAccessPasswords().includes(trimmed);
}

export function checkCompRequest(req: Request) {
  return isValidCompPassword(req.headers.get("x-comp-password") || "");
}

export function compUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireComp(req: Request): NextResponse | null {
  if (checkCompRequest(req)) return null;
  return compUnauthorizedResponse();
}
