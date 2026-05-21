import { NextResponse } from "next/server";
import { getLoginPreviewData } from "@/lib/loginPreview";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLoginPreviewData();

    const res = NextResponse.json({
      success: true,
      ...data,
    });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load login preview." },
      { status: 500 }
    );
  }
}
