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
    const keys = await redis.keys("orderHistory:*");
    const orders: OrderRecord[] = [];

    for (const key of keys) {
      const accountNo = key.replace(/^orderHistory:/, "").toUpperCase();
      const history = (await redis.get<OrderRecord[]>(key)) || [];

      for (const entry of history) {
        const items = Array.isArray(entry?.items) ? entry.items : [];
        orders.push({
          accountNo: String(entry?.accountNo || accountNo).trim().toUpperCase(),
          storeName: entry?.storeName || "",
          orderRef: entry?.orderRef || "",
          phone: entry?.phone || "",
          note: entry?.note || "",
          items,
          createdAt: entry?.createdAt || "",
        });
      }
    }

    orders.sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    return NextResponse.json({
      success: true,
      orders: orders.slice(0, 500),
      total: orders.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load orders." },
      { status: 500 }
    );
  }
}
