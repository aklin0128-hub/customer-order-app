import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Customer = {
  accountNo: string;
  storeName: string;
  password: string;
  active?: boolean;
  email?: string;
  phone?: string;
  note?: string;
  updatedAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function normalizeAccount(accountNo: string) {
  return String(accountNo || "").trim().toUpperCase();
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const keys = await redis.keys("customer:*");
    const customers: Customer[] = [];

    for (const key of keys) {
      const item = await redis.get<Customer>(key);
      if (!item?.accountNo) continue;

      customers.push({
        accountNo: normalizeAccount(item.accountNo),
        storeName: item.storeName || "",
        password: item.password || "",
        active: item.active !== false,
        email: item.email || "",
        phone: item.phone || "",
        note: item.note || "",
        updatedAt: item.updatedAt || "",
      });
    }

    customers.sort((a, b) => a.accountNo.localeCompare(b.accountNo));

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

    const accountNo = normalizeAccount(body?.accountNo);
    const storeName = String(body?.storeName || "").trim();
    const password = String(body?.password || "").trim();
    const active = body?.active !== false;
    const email = String(body?.email || "").trim();
    const phone = String(body?.phone || "").trim();
    const note = String(body?.note || "").trim();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    if (!storeName) {
      return NextResponse.json({ error: "Missing store name." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Missing customer password." }, { status: 400 });
    }

    const customer: Customer = {
      accountNo,
      storeName,
      password,
      active,
      email,
      phone,
      note,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(`customer:${accountNo}`, customer);

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
    const accountNo = normalizeAccount(url.searchParams.get("accountNo") || "");

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    await redis.del(`customer:${accountNo}`);

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
