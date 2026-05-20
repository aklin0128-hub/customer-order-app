import { NextResponse } from "next/server";
import { getFrequentSkusNotInCart } from "@/lib/recommendedSkus";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountNo = url.searchParams.get("accountNo") || "";
    const cart = (url.searchParams.get("cart") || "").split(",").filter(Boolean);
    const rows = await getFrequentSkusNotInCart(accountNo, cart, 15);
    return NextResponse.json({ success: true, rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load recommendations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
