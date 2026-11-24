import { NextResponse } from "next/server";
import { getNdhProducts } from "@/lib/ndh";
import { cachedServerData, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=120, stale-while-revalidate=600";

export async function GET() {
  try {
    const products = await cachedServerData(SERVER_CACHE.ndh, "active", () =>
      getNdhProducts({ activeOnly: true })
    );

    const res = NextResponse.json({
      success: true,
      products,
    });
    res.headers.set("Cache-Control", CACHE_CONTROL);
    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load NDH items.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
