import { NextResponse } from "next/server";

import { getPublicOrderNotice } from "@/lib/orderNotice";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notice = await getPublicOrderNotice();
    return NextResponse.json(
      { success: true, notice },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
