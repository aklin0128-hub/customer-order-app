import { NextResponse } from "next/server";

import { adminSkuSuggest } from "@/lib/adminSkuSuggest";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

export async function GET(req: Request) {
  if ((req.headers.get("x-admin-password") || "") !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") || 15)));
    const includeInventory = url.searchParams.get("inventory") === "1";

    const results = await adminSkuSuggest(q, limit, { includeInventory });
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SKU suggest failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
