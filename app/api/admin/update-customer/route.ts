import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { loadCustomers } from "@/lib/loadCustomers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();
    const storeName = String(body?.storeName || "").trim();
    const newPassword = String(body?.password || "").trim();
    const active = body?.active !== false;

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    if (!storeName) {
      return NextResponse.json({ error: "Missing store name." }, { status: 400 });
    }

    const existingRedis = await redis.get<any>(`customer:${accountNo}`);

    const csvCustomer = loadCustomers().find(
      (c) => c.accountNo.toUpperCase() === accountNo
    );

    const finalPassword =
      newPassword ||
      existingRedis?.password ||
      csvCustomer?.password ||
      "";

    if (!finalPassword) {
      return NextResponse.json(
        { error: "Password is required for new customer." },
        { status: 400 }
      );
    }

    await redis.set(`customer:${accountNo}`, {
      accountNo,
      storeName,
      password: finalPassword,
      active,
      source: "Redis",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      customer: {
        accountNo,
        storeName,
        active,
        source: "Redis",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update customer." },
      { status: 500 }
    );
  }
}