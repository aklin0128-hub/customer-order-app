import { NextResponse } from "next/server";
import { getClearanceProducts } from "@/lib/clearance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getClearanceProducts({ activeOnly: true });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load clearance items." },
      { status: 500 }
    );
  }
}
