import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadCustomers } from "@/lib/loadCustomers";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const map = new Map<string, any>();

    const csvCustomers = loadCustomers();

    for (const c of csvCustomers) {
      const accountNo = String(c.accountNo || "").trim().toUpperCase();
      if (!accountNo) continue;

      map.set(accountNo, {
        accountNo,
        storeName: String(c.storeName || "").trim(),
        active: c.active !== false,
        source: "CSV",
      });
    }

    const keys = await redis.keys("customer:*");

    for (const key of keys) {
      const c = await redis.get<any>(key);
      const accountNo = String(c?.accountNo || "").trim().toUpperCase();
      if (!accountNo) continue;

      map.set(accountNo, {
        accountNo,
        storeName: String(c?.storeName || "").trim(),
        active: c?.active !== false,
        source: "Redis",
      });
    }

    return NextResponse.json({
      success: true,
      customers: Array.from(map.values()).sort((a, b) =>
        a.accountNo.localeCompare(b.accountNo)
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load customers." },
      { status: 500 }
    );
  }
}