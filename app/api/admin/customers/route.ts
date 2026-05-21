import { NextResponse } from "next/server";
import { matchesQuery, paginateList, parseAdminListQuery } from "@/lib/adminListQuery";
import {
  getAllCustomers,
  normalizeAccountNo,
  removeCustomerAccess,
  type CustomerRecord,
} from "@/lib/customers";
import {
  emailForCustomerStorage,
  isAllowedOrderRecipientEmail,
  isValidOrderEmail,
} from "@/lib/customerOrderEmail";
import { normalizeMarketRegion } from "@/lib/customerRegion";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { indexCustomerAccount } from "@/lib/redisIndexes";
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
    const url = new URL(req.url);
    const query = parseAdminListQuery(url, 50);
    const accountNo = (url.searchParams.get("accountNo") || "").trim().toUpperCase();
    const status = url.searchParams.get("status") || "all";
    const region = url.searchParams.get("region") || "all";

    let customers = await getAllCustomers();

    if (accountNo) {
      const one = customers.find((c) => c.accountNo.toUpperCase() === accountNo);
      return NextResponse.json({
        success: true,
        customers: one ? [one] : [],
        total: one ? 1 : 0,
        page: 1,
        totalPages: 1,
      });
    }

    customers = customers.filter((c) => {
      if (status === "active" && c.active === false) return false;
      if (status === "inactive" && c.active !== false) return false;
      if (region === "unassigned" && c.region) return false;
      if (region !== "all" && region !== "unassigned" && c.region !== region) return false;
      if (!query.q) return true;
      const hay = `${c.accountNo} ${c.storeName} ${c.email || ""} ${c.phone || ""}`;
      return matchesQuery(hay, query.q);
    });

    customers.sort((a, b) => a.accountNo.localeCompare(b.accountNo));
    const page = paginateList(customers, query);

    return NextResponse.json({
      success: true,
      customers: page.items,
      total: page.total,
      page: page.page,
      totalPages: page.totalPages,
      limit: page.limit,
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
    const emailRaw = String(body?.email || "").trim();
    let email: string | undefined;
    if (emailRaw) {
      if (!isValidOrderEmail(emailRaw)) {
        return NextResponse.json({ error: "Invalid order recipient email." }, { status: 400 });
      }
      if (!isAllowedOrderRecipientEmail(emailRaw)) {
        return NextResponse.json(
          { error: "Email is not in the allowed order recipient list." },
          { status: 400 }
        );
      }
      try {
        email = emailForCustomerStorage(emailRaw);
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Invalid email." }, { status: 400 });
      }
    }
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
    bustAnalyticsCache();

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

    const result = await removeCustomerAccess(accountNo);

    return NextResponse.json({
      success: true,
      accountNo: result.accountNo,
      mode: result.mode,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete customer." },
      { status: 500 }
    );
  }
}
