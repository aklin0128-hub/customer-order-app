import { NextResponse } from "next/server";
import {
  buildCatalogQtyMapFromDraft,
  ensureDeviceCarts,
  resolveItemAddedAt,
  type OrderDraftPayload,
} from "@/lib/orderDraft";
import { listDraftAccounts } from "@/lib/redisIndexes";
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
    const accounts = await listDraftAccounts();
    const drafts = await Promise.all(
      accounts.map(async (accountNo) => ({
        key: `draft:${accountNo}`,
        draft: await redis.get<OrderDraftPayload>(`draft:${accountNo}`),
      }))
    );

    const carts = drafts
      .map(({ key, draft }) => {
        const normalized = ensureDeviceCarts(draft) || draft;
        const accountNo = String(
          normalized?.accountNo || key.replace(/^draft:/, "")
        )
          .trim()
          .toUpperCase();
        const qtyMap = buildCatalogQtyMapFromDraft(normalized);
        const items = Object.entries(qtyMap)
          .map(([sku, qty]) => ({
            sku,
            qty,
            addedAt: resolveItemAddedAt(normalized, sku),
          }))
          .sort((a, b) => String(a.sku).localeCompare(String(b.sku)));
        const totalCases = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

        return {
          accountNo,
          storeName: normalized?.storeName || "",
          phone: normalized?.phone || "",
          note: normalized?.note || "",
          updatedAt: normalized?.updatedAt || "",
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
