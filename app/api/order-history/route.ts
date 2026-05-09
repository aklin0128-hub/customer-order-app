import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = String(searchParams.get("accountNo") || "")
      .trim()
      .toUpperCase();

    if (!accountNo) {
      return NextResponse.json(
        { error: "Missing account number." },
        { status: 400 }
      );
    }

    const history = (await redis.get<any[]>(`orderHistory:${accountNo}`)) || [];

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load order history." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();

    if (!accountNo) {
      return NextResponse.json(
        { error: "Missing account number." },
        { status: 400 }
      );
    }

    const order = {
      accountNo,
      storeName: body?.storeName || "",
      orderRef: body?.orderRef || "",
      items: Array.isArray(body?.items) ? body.items : [],
      note: body?.note || "",
      phone: body?.phone || "",
      createdAt: new Date().toISOString(),
    };

    const current = (await redis.get<any[]>(`orderHistory:${accountNo}`)) || [];
    const next = [order, ...current].slice(0, 20);

    await redis.set(`orderHistory:${accountNo}`, next);

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save order history." },
      { status: 500 }
    );
  }
}