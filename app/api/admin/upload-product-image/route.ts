import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();

    const sku = String(formData.get("sku") || "").trim().toUpperCase();
    const file = formData.get("file") as File | null;

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
        ? "webp"
        : "jpg";

    const blob = await put(`product-images/${sku}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const existing = (await redis.get<any>(`product:${sku}`)) || {};

    await redis.set(`product:${sku}`, {
      ...existing,
      sku,
      imageUrl: blob.url,
      source: "Redis",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      imageUrl: blob.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload image." },
      { status: 500 }
    );
  }
}