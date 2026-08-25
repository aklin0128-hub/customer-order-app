import { NextResponse } from "next/server";
import { adminSearch } from "@/lib/adminSearch";
import { checkCompRequest, compUnauthorizedResponse } from "@/lib/compAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkCompRequest(req)) {
    return compUnauthorizedResponse();
  }

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") || 12)));
    const results = await adminSearch(q, limit, { types: ["account"] });
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
