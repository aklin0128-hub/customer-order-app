import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountNo = (body?.accountNo || "").trim().toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const draft = {
      accountNo,
      storeName: body?.storeName || "",
      phone: body?.phone || "",
      note: body?.note || "",
      cart: Array.isArray(body?.cart) ? body.cart : [],
      catalogQtyMap: body?.catalogQtyMap && typeof body.catalogQtyMap === "object" ? body.catalogQtyMap : {},
      updatedAt: new Date().toISOString(),
    };

    await redis.set(`draft:${accountNo}`, draft);

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