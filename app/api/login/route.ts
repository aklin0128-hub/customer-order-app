import { NextResponse } from "next/server";
import { loadCustomers } from "@/lib/loadCustomers";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountNo = String(body?.accountNo || "").trim().toUpperCase();
    const password = String(body?.password || "").trim();

    if (!accountNo || !password) {
      return NextResponse.json(
        { error: "Missing account number or password." },
        { status: 400 }
      );
    }

    const redisCustomer = await redis.get<any>(`customer:${accountNo}`);

    if (redisCustomer) {
      const redisPassword = String(redisCustomer.password || "").trim();

      if (redisCustomer.active === false) {
        return NextResponse.json({ error: "Account inactive." }, { status: 401 });
      }

      if (redisPassword !== password) {
        return NextResponse.json(
          { error: "Invalid account number or password." },
          { status: 401 }
        );
      }

      return NextResponse.json({
        success: true,
        customer: {
          accountNo,
          storeName: redisCustomer.storeName || "",
        },
      });
    }

    const csvCustomer = loadCustomers().find(
      (c) =>
        c.active &&
        c.accountNo.toUpperCase() === accountNo &&
        String(c.password || "").trim() === password
    );

    if (!csvCustomer) {
      return NextResponse.json(
        { error: "Invalid account number or password." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: {
        accountNo: csvCustomer.accountNo,
        storeName: csvCustomer.storeName,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Login failed." },
      { status: 500 }
    );
  }
}