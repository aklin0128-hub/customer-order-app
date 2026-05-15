import { NextResponse } from "next/server";
import { getPromotionProducts } from "@/lib/promotions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getPromotionProducts({ activeOnly: true });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load promotions." },
      { status: 500 }
    );
  }
}
