import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type DraftRecord = {
  accountNo?: string;
  storeName?: string;
  phone?: string;
  note?: string;
  cart?: { sku: string; qty: string }[];
  catalogQtyMap?: Record<string, string>;
  updatedAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const keys = await redis.keys("draft:*");
    const drafts = await Promise.all(
      keys.map(async (key) => ({
        key,
        draft: await redis.get<DraftRecord>(key),
      }))
    );

    const carts = drafts
      .map(({ key, draft }) => {
        const accountNo = String(draft?.accountNo || key.replace(/^draft:/, "")).trim().toUpperCase();
        const cart = Array.isArray(draft?.cart) ? draft.cart : [];
        const mapItems = Object.entries(draft?.catalogQtyMap || {})
          .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty || "").trim() }))
          .filter((item) => item.sku && Number(item.qty) > 0);
        const merged = new Map<string, { sku: string; qty: string }>();

        for (const item of [...cart, ...mapItems]) {
          const sku = String(item?.sku || "").trim().toUpperCase();
          const qty = String(item?.qty || "").trim();
          if (!sku || Number(qty) <= 0) continue;
          merged.set(sku, { sku, qty });
        }

        const items = Array.from(merged.values());
        const totalCases = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

        return {
          accountNo,
          storeName: draft?.storeName || "",
          phone: draft?.phone || "",
          note: draft?.note || "",
          updatedAt: draft?.updatedAt || "",
          items,
          lineCount: items.length,
          totalCases,
        };
      })
      .filter((cart) => cart.lineCount > 0)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    return NextResponse.json({ success: true, carts });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load active carts." },
      { status: 500 }
    );
  }
}
