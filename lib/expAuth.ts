import { NextResponse } from "next/server";

/** Accepted passwords for /exp. Defaults keep 536678 and add 2026. */
const DEFAULT_EXP_PASSWORDS = ["536678", "2026"];

export function getExpAccessPasswords(): string[] {
  const passwords = new Set(DEFAULT_EXP_PASSWORDS);

  const fromEnv = process.env.EXP_ACCESS_PASSWORD || "";
  for (const part of fromEnv.split(",")) {
    const trimmed = part.trim();
    if (trimmed) passwords.add(trimmed);
  }

  return [...passwords];
}

/** @deprecated Prefer getExpAccessPasswords / isValidExpPassword */
export function getExpAccessPassword() {
  return getExpAccessPasswords()[0] || "536678";
}

export function isValidExpPassword(password: string) {
  const trimmed = String(password || "").trim();
  return Boolean(trimmed) && getExpAccessPasswords().includes(trimmed);
}

export function checkExpRequest(req: Request) {
  return isValidExpPassword(req.headers.get("x-exp-password") || "");
}

export function expUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireExp(req: Request): NextResponse | null {
  if (checkExpRequest(req)) return null;
  return expUnauthorizedResponse();
}
