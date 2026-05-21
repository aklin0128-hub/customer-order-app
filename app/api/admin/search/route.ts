import { NextResponse } from "next/server";
import { adminSearch } from "@/lib/adminSearch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") || 16)));
    const typesParam = url.searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as import("@/lib/adminSearch").AdminSearchResult["type"][])
      : undefined;
    const results = await adminSearch(q, limit, { types });
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
