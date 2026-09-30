import { NextResponse } from "next/server";

import { isValidCompPassword } from "@/lib/compAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = String(body?.password || "").trim();

    if (!password) {
      return NextResponse.json({ error: "Password required." }, { status: 400 });
    }

    if (!isValidCompPassword(password)) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
