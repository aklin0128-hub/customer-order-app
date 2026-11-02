import { NextResponse } from "next/server";
import { isValidCreditPassword } from "@/lib/creditAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const password = String(body?.password || "").trim();
    if (!isValidCreditPassword(password)) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
