import { NextResponse } from "next/server";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getMergedCatalogProducts();

    const res = NextResponse.json({
      success: true,
      products,
    });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load catalog." },
      { status: 500 }
    );
  }
}