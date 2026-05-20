import { NextResponse } from "next/server";
import { cleanSku } from "@/lib/analyticsCommon";
import { getPriceDistribution } from "@/lib/priceDistribution";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const sku = cleanSku(url.searchParams.get("sku") || "");
    const days = Number(url.searchParams.get("days") || 180);

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const result = await getPriceDistribution({ sku, days });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load price distribution." },
      { status: 500 }
    );
  }
}
