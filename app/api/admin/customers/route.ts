import { NextResponse } from "next/server";
import {
  getAllCustomers,
  normalizeAccountNo,
  type CustomerRecord,
} from "@/lib/customers";
import { normalizeMarketRegion } from "@/lib/customerRegion";
import { loadCustomers } from "@/lib/loadCustomers";
import { indexCustomerAccount, unindexCustomerAccount } from "@/lib/redisIndexes";
import { redis } from "@/lib/redis";

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
    const customers = await getAllCustomers();

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load customers." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();

    const accountNo = normalizeAccountNo(body?.accountNo);
    const storeName = String(body?.storeName || "").trim();
    const password = String(body?.password || "").trim();
    const active = body?.active !== false;
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const note = String(body?.note || "").trim();
    const regionRaw = body?.region;
    const region =
      regionRaw === "" || regionRaw === null || regionRaw === undefined
        ? undefined
        : normalizeMarketRegion(regionRaw);

    if (regionRaw && !region) {
      return NextResponse.json(
        { error: "Invalid region. Choose Miami, Orlando, Melbourne, or Jacksonville." },
        { status: 400 }
      );
    }

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    if (!storeName) {
      return NextResponse.json({ error: "Missing store name." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Missing customer password." }, { status: 400 });
    }

    const customer: CustomerRecord = {
      accountNo,
      storeName,
      password,
      active,
      email: email || undefined,
      phone: phone || undefined,
      note: note || undefined,
      region,
      updatedAt: new Date().toISOString(),
      source: "redis",
    };

    await redis.set(`customer:${accountNo}`, customer);
    await indexCustomerAccount(accountNo);

    return NextResponse.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save customer." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const accountNo = normalizeAccountNo(url.searchParams.get("accountNo") || "");

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const existingRedis = await redis.get<CustomerRecord>(`customer:${accountNo}`);

    if (existingRedis) {
      await redis.del(`customer:${accountNo}`);
      await unindexCustomerAccount(accountNo);
    } else {
      const local = loadCustomers().find((c) => normalizeAccountNo(c.accountNo) === accountNo);
      if (!local) {
        return NextResponse.json({ error: "Customer not found." }, { status: 404 });
      }

      await redis.set(`customer:${accountNo}`, {
        accountNo,
        storeName: local.storeName,
        password: local.password,
        active: false,
        note: "Disabled in admin (CSV account)",
        updatedAt: new Date().toISOString(),
        source: "redis",
      });
      await indexCustomerAccount(accountNo);
    }

    return NextResponse.json({
      success: true,
      deleted: accountNo,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete customer." },
      { status: 500 }
    );
  }
}
