import { NextResponse } from "next/server";
import { getMarketAnalytics, type MarketPeriod } from "@/lib/marketAnalytics";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

const PERIODS: MarketPeriod[] = ["biweekly", "monthly", "quarterly", "year"];

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const raw = String(url.searchParams.get("period") || "monthly").toLowerCase();
    const period = PERIODS.includes(raw as MarketPeriod) ? (raw as MarketPeriod) : "monthly";

    const result = await getMarketAnalytics(period);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load market analytics." },
      { status: 500 }
    );
  }
}
