import { countDraftItems, normalizeOrderDraft, type OrderDraftPayload } from "@/lib/orderDraft";
import { NextResponse } from "next/server";
import { indexDraftAccount } from "@/lib/redisIndexes";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountNo = (body?.accountNo || "").trim().toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const allowClear = Boolean(body?.allowClear);
    const incoming = normalizeOrderDraft(accountNo, {
      storeName: body?.storeName,
      phone: body?.phone,
      note: body?.note,
      orderEmail: body?.orderEmail,
      cart: body?.cart,
      catalogQtyMap: body?.catalogQtyMap,
      updatedAt: new Date().toISOString(),
    });

    const existing = await redis.get<OrderDraftPayload>(`draft:${accountNo}`);
    let draft = incoming;

    if (
      existing &&
      !allowClear &&
      countDraftItems(incoming) === 0 &&
      countDraftItems(existing) > 0
    ) {
      draft = normalizeOrderDraft(accountNo, {
        ...existing,
        phone: incoming.phone,
        note: incoming.note,
        orderEmail: incoming.orderEmail,
        storeName: incoming.storeName || existing.storeName,
        updatedAt: incoming.updatedAt,
      });
    }

    await redis.set(`draft:${accountNo}`, draft);
    await indexDraftAccount(accountNo);

    return NextResponse.json({
      success: true,
      message: "Cloud draft saved.",
      draft,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to save draft.",
        stack: error?.stack || null,
      },
      { status: 500 }
    );
  }
}