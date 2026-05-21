import { matchesQuery, paginateList, parseAdminListQuery } from "@/lib/adminListQuery";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type OrderItem = { sku: string; qty: string };

type OrderRecord = {
  accountNo: string;
  storeName?: string;
  orderRef?: string;
  phone?: string;
  note?: string;
  items?: OrderItem[];
  createdAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const query = parseAdminListQuery(url, 40);
    const keys = await redis.keys("orderHistory:*");
    const orders: OrderRecord[] = [];

    for (const key of keys) {
      const accountNo = key.replace(/^orderHistory:/, "").toUpperCase();
      const history = (await redis.get<OrderRecord[]>(key)) || [];

      for (const entry of history) {
        const items = Array.isArray(entry?.items) ? entry.items : [];
        const row: OrderRecord = {
          accountNo: String(entry?.accountNo || accountNo).trim().toUpperCase(),
          storeName: entry?.storeName || "",
          orderRef: entry?.orderRef || "",
          phone: entry?.phone || "",
          note: entry?.note || "",
          items,
          createdAt: entry?.createdAt || "",
        };
        const hay = `${row.accountNo} ${row.storeName} ${row.orderRef} ${row.phone}`;
        if (!matchesQuery(hay, query.q)) continue;
        orders.push(row);
      }
    }

    orders.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    const page = paginateList(orders, query);

    return NextResponse.json({
      success: true,
      orders: page.items,
      total: page.total,
      page: page.page,
      totalPages: page.totalPages,
      limit: page.limit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load orders." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const targets = Array.isArray(body?.orders) ? body.orders : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: "No orders selected." }, { status: 400 });
    }

    let deletedCount = 0;
    const byAccount = new Map<string, { orderRef: string; createdAt: string }[]>();

    for (const target of targets) {
      const accountNo = String(target?.accountNo || "").trim().toUpperCase();
      const orderRef = String(target?.orderRef || "").trim();
      const createdAt = String(target?.createdAt || "").trim();
      if (!accountNo || !orderRef || !createdAt) continue;

      const list = byAccount.get(accountNo) || [];
      list.push({ orderRef, createdAt });
      byAccount.set(accountNo, list);
    }

    for (const [accountNo, accountTargets] of byAccount.entries()) {
      const key = `orderHistory:${accountNo}`;
      const current = (await redis.get<OrderRecord[]>(key)) || [];
      const next = current.filter((order) => {
        const match = accountTargets.some((target) =>
          String(order.orderRef || "").trim() === target.orderRef &&
          String(order.createdAt || "").trim() === target.createdAt
        );
        if (match) deletedCount += 1;
        return !match;
      });

      await redis.set(key, next);
    }

    return NextResponse.json({ success: true, deletedCount });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete orders." },
      { status: 500 }
    );
  }
}
