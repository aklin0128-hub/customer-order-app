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

    const recentItems = (await redis.get<any[]>(`recentItems:${accountNo}`)) || [];

    return NextResponse.json({
      success: true,
      recentItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load recent items." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!accountNo) {
      return NextResponse.json(
        { error: "Missing account number." },
        { status: 400 }
      );
    }

    const current = (await redis.get<any[]>(`recentItems:${accountNo}`)) || [];
    const map = new Map<string, any>();

    for (const item of current) {
      if (item?.sku) {
        map.set(String(item.sku).toUpperCase(), item);
      }
    }

    for (const item of items) {
      const sku = String(item?.sku || "").trim().toUpperCase();
      if (!sku) continue;

      map.set(sku, {
        sku,
        qty: String(item?.qty || "1"),
        lastOrderedAt: new Date().toISOString(),
      });
    }

    const recentItems = Array.from(map.values())
      .sort((a, b) =>
        String(b.lastOrderedAt || "").localeCompare(String(a.lastOrderedAt || ""))
      )
      .slice(0, 30);

    await redis.set(`recentItems:${accountNo}`, recentItems);

    return NextResponse.json({
      success: true,
      recentItems,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save recent items." },
      { status: 500 }
    );
  }
}