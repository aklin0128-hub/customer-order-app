import { NextResponse } from "next/server";
import { unindexDraftAccount } from "@/lib/redisIndexes";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountNo = (body?.accountNo || "").trim().toUpperCase();

    if (!accountNo) {
      return NextResponse.json(
        { error: "Missing account number." },
        { status: 400 }
      );
    }

    await redis.del(`draft:${accountNo}`);
    await unindexDraftAccount(accountNo);

    return NextResponse.json({
      success: true,
      message: "Cloud draft deleted.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete draft." },
      { status: 500 }
    );
  }
}