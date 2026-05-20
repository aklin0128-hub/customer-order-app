import { NextResponse } from "next/server";
import { getAllCustomers, getCustomerByAccount, normalizeAccountNo } from "@/lib/customers";
import { normalizeMarketRegion } from "@/lib/customerRegion";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { indexCustomerAccount } from "@/lib/redisIndexes";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const accounts = Array.isArray(body?.accountNos)
      ? body.accountNos.map((a: unknown) => normalizeAccountNo(String(a || ""))).filter(Boolean)
      : [];
    const regionRaw = body?.region;

    if (!accounts.length) {
      return NextResponse.json({ error: "Select at least one account." }, { status: 400 });
    }

    const region =
      regionRaw === "" || regionRaw === null || regionRaw === undefined
        ? undefined
        : normalizeMarketRegion(regionRaw);

    if (regionRaw && !region) {
      return NextResponse.json({ error: "Invalid region." }, { status: 400 });
    }

    let updated = 0;
    for (const acct of accounts) {
      const existing = await getCustomerByAccount(acct);
      if (!existing) continue;

      await redis.set(`customer:${acct}`, {
        accountNo: acct,
        storeName: existing.storeName,
        password: existing.password,
        active: existing.active,
        email: existing.email,
        phone: existing.phone,
        note: existing.note,
        region,
        updatedAt: new Date().toISOString(),
        source: "redis",
      });
      await indexCustomerAccount(acct);
      updated += 1;
    }

    bustAnalyticsCache();

    return NextResponse.json({
      success: true,
      updated,
      customers: await getAllCustomers(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update regions." },
      { status: 500 }
    );
  }
}
