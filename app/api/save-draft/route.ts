import {
  countDraftItems,
  draftTimestamp,
  normalizeOrderDraft,
  type OrderDraftPayload,
} from "@/lib/orderDraft";
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
      updatedAt: body?.updatedAt,
    });

    const existing = await redis.get<OrderDraftPayload>(`draft:${accountNo}`);
    let draft = incoming;

    // Ignore stale empty autosaves (e.g. before draft load). User deletes send a newer updatedAt.
    const incomingIsStaleEmpty =
      countDraftItems(incoming) === 0 &&
      Boolean(existing && countDraftItems(existing) > 0) &&
      draftTimestamp(incoming) <= draftTimestamp(existing);

    if (existing && !allowClear && incomingIsStaleEmpty) {
      draft = normalizeOrderDraft(accountNo, {
        ...existing,
        phone: incoming.phone,
        note: incoming.note,
        orderEmail: incoming.orderEmail,
        storeName: incoming.storeName || existing.storeName,
        updatedAt: existing.updatedAt,
      });
    }

    if (allowClear || (countDraftItems(incoming) === 0 && !incomingIsStaleEmpty)) {
      if (countDraftItems(incoming) === 0) {
        await redis.del(`draft:${accountNo}`);
        const { unindexDraftAccount } = await import("@/lib/redisIndexes");
        await unindexDraftAccount(accountNo);
        return NextResponse.json({
          success: true,
          message: "Cloud draft cleared.",
          draft: incoming,
        });
      }
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