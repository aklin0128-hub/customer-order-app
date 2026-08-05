import {
  resolveCollaborativeCloudSave,
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
    const deviceId = String(body?.deviceId || "").trim();
    const incoming = normalizeOrderDraft(accountNo, {
      storeName: body?.storeName,
      phone: body?.phone,
      note: body?.note,
      orderEmail: body?.orderEmail,
      cart: body?.cart,
      catalogQtyMap: body?.catalogQtyMap,
      deviceCarts: body?.deviceCarts,
      removedSkus: body?.removedSkus,
      updatedAt: body?.updatedAt,
    });

    const existing = await redis.get<OrderDraftPayload>(`draft:${accountNo}`);
    const resolved = resolveCollaborativeCloudSave({
      incoming,
      existing,
      allowClear,
      deviceId,
      deviceQtyMap: body?.deviceQtyMap,
      removedSkus: body?.removedSkus,
    });

    if (resolved === "delete") {
      await redis.del(`draft:${accountNo}`);
      const { unindexDraftAccount } = await import("@/lib/redisIndexes");
      await unindexDraftAccount(accountNo);
      return NextResponse.json({
        success: true,
        message: "Cloud draft cleared.",
        draft: incoming,
      });
    }

    await redis.set(`draft:${accountNo}`, resolved);
    await indexDraftAccount(accountNo);

    return NextResponse.json({
      success: true,
      message: "Cloud draft saved.",
      draft: resolved,
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
