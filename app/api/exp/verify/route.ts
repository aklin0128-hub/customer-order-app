import { NextResponse } from "next/server";

import { isValidExpPassword } from "@/lib/expAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = String(body?.password || "").trim();

    if (!password) {
      return NextResponse.json({ error: "Password required." }, { status: 400 });
    }

    if (!isValidExpPassword(password)) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
