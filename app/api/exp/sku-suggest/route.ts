import { NextResponse } from "next/server";

import { adminSkuSuggest } from "@/lib/adminSkuSuggest";
import { requireExp } from "@/lib/expAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = requireExp(req);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") || 15)));
    const results = await adminSkuSuggest(q, limit, { includeInventory: true });
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "SKU suggest failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
