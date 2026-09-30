import {
  favoriteSkusRedisKey,
  normalizeFavoriteSkusPayload,
  type FavoriteSkusPayload,
} from "@/lib/favoriteSkus";
import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountNo = String(searchParams.get("accountNo") || "")
      .trim()
      .toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const key = favoriteSkusRedisKey(accountNo);
    const raw = await redis.get<unknown>(key);
    const favorites = raw
      ? normalizeFavoriteSkusPayload(accountNo, raw)
      : normalizeFavoriteSkusPayload(accountNo, []);

    return NextResponse.json({
      success: true,
      favorites,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load favorite SKUs." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accountNo = String(body?.accountNo || "")
      .trim()
      .toUpperCase();

    if (!accountNo) {
      return NextResponse.json({ error: "Missing account number." }, { status: 400 });
    }

    const incoming = normalizeFavoriteSkusPayload(accountNo, {
      skus: body?.skus,
      updatedAt: body?.updatedAt,
    });
    if (!incoming.updatedAt) {
      incoming.updatedAt = Date.now();
    }

    const key = favoriteSkusRedisKey(accountNo);
    const existingRaw = await redis.get<unknown>(key);
    const existing = existingRaw
      ? normalizeFavoriteSkusPayload(accountNo, existingRaw)
      : null;

    // Last-write-wins so unfavorite on one device clears on peers.
    let saved: FavoriteSkusPayload = incoming;
    if (existing && existing.updatedAt > incoming.updatedAt) {
      saved = existing;
    } else {
      await redis.set(key, saved);
    }

    return NextResponse.json({
      success: true,
      favorites: saved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save favorite SKUs." },
      { status: 500 }
    );
  }
}
