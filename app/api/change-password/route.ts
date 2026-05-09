import { NextResponse } from "next/server";
import { loadCustomers } from "@/lib/loadCustomers";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();
    const oldPassword = String(body?.oldPassword || "").trim();
    const newPassword = String(body?.newPassword || "").trim();

    if (!accountNo || !oldPassword || !newPassword) {
      return NextResponse.json(
        { error: "Missing account number or password." },
        { status: 400 }
      );
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: "New password must be at least 4 characters." },
        { status: 400 }
      );
    }

    const redisCustomer = await redis.get<any>(`customer:${accountNo}`);
    const csvCustomer = loadCustomers().find(
      (c) => c.accountNo.toUpperCase() === accountNo
    );

    const currentPassword = redisCustomer?.password || csvCustomer?.password;

    if (!currentPassword || currentPassword !== oldPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    await redis.set(`customer:${accountNo}`, {
      accountNo,
      storeName: redisCustomer?.storeName || csvCustomer?.storeName || "",
      password: newPassword,
      active:
        typeof redisCustomer?.active === "boolean"
          ? redisCustomer.active
          : csvCustomer?.active ?? true,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Password changed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to change password." },
      { status: 500 }
    );
  }
}