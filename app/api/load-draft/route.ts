import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = (searchParams.get("accountNo") || "").trim().toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const draft = await redis.get(`draft:${accountNo}`);

    return NextResponse.json({
      success: true,
      draft: draft || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load draft.",
        stack: error?.stack || null,
      },
      { status: 500 }
    );
  }
}