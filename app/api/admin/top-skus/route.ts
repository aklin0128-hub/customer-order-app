import { NextResponse } from "next/server";
import { getTopSkus } from "@/lib/topSkus";

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
    const days = Number(url.searchParams.get("days") || 0);
    const limit = Number(url.searchParams.get("limit") || 100);

    const result = await getTopSkus({
      days: Number.isFinite(days) && days > 0 ? days : undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load top SKUs." },
      { status: 500 }
    );
  }
}
