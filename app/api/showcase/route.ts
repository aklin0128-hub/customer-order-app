import { NextResponse } from "next/server";
import { getShowcaseData } from "@/lib/loginPreview";

export const dynamic = "force-dynamic";

/** Full public showcase (no login). Same data as /new/. */
export async function GET() {
  try {
    const data = await getShowcaseData();

    const res = NextResponse.json({
      success: true,
      ...data,
    });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load showcase." },
      { status: 500 }
    );
  }
}
