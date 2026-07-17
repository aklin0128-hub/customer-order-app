import { NextResponse } from "next/server";

/** Password for /exp coworker inventory lookup (set EXP_ACCESS_PASSWORD in production). */
export function getExpAccessPassword() {
  return process.env.EXP_ACCESS_PASSWORD || "2026";
}

export function checkExpRequest(req: Request) {
  return (req.headers.get("x-exp-password") || "") === getExpAccessPassword();
}

export function expUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export function requireExp(req: Request): NextResponse | null {
  if (checkExpRequest(req)) return null;
  return expUnauthorizedResponse();
}
