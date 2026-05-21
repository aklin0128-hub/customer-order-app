import { NextResponse } from "next/server";
import { getBrandInsights, type BrandInsightsDays } from "@/lib/brandAnalytics";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";
const DAY_OPTIONS: BrandInsightsDays[] = [30, 90, 180, 365, 0];

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const daysRaw = Number(url.searchParams.get("days") || 90);
    const days = DAY_OPTIONS.includes(daysRaw as BrandInsightsDays)
      ? (daysRaw as BrandInsightsDays)
      : 90;
    const groupBy = url.searchParams.get("groupBy") === "category" ? "category" : "brand";

    const result = await getBrandInsights({ days, groupBy });

    const res = NextResponse.json({ success: true, ...result });
    res.headers.set("Cache-Control", "private, max-age=300");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load brand insights." },
      { status: 500 }
    );
  }
}
