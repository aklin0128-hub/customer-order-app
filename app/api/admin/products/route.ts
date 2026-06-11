import { NextResponse } from "next/server";
import { loadRedisProducts, productRedisKey, saveRedisProduct } from "@/lib/productRedisStore";
import { parseCategoriesFromBody, expandCategoryTags } from "@/lib/productCategories";
import {
  mainCategoryToNewItemStorageLabel,
  parseNewItemStorageLabel,
  resolveNewItemStorageLabel,
} from "@/lib/newItemStorageLabel";
import { mapLegacyCategoryToMain } from "@/lib/catalogMainCategories";
import { parseNewPublishedDate } from "@/lib/catalogNewItems";
import { normalizeNewItemListPrice } from "@/lib/newItemListPrice";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
  limitedQty?: string;
  palletSize?: string;
  imageUrl?: string;
  category?: string;
  categories?: string[];
  isNew?: boolean;
  justAdded?: boolean;
  importedAt?: string;
  newSince?: string;
  newPublishedDate?: string;
  newItemDescription?: string;
  newItemDescriptionPdfUrl?: string;
  newItemStorageLabel?: "DRY" | "FROZEN" | "FRESH";
  newItemListPrice?: string;
  source?: string;
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
    const map = new Map<string, Product>();

    for (const item of catalogData as Product[]) {
      if (!item.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...item,
        sku,
        source: "Catalog",
      });
    }

    const redisProducts = await loadRedisProducts<Product>();

    for (const item of redisProducts) {
      if (!item?.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...(map.get(sku) || {}),
        ...item,
        sku,
        source: "Redis",
      });
    }

    return NextResponse.json({
      success: true,
      products: Array.from(map.values()).sort((a, b) =>
        a.sku.localeCompare(b.sku)
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load products." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();

    const sku = String(body?.sku || "").trim().toUpperCase();
    const name = String(body?.name || "").trim();
    const brand = String(body?.brand || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();
    const size = String(body?.size || "").trim();
    const barcode = String(body?.barcode || "").trim();
    const upc = String(body?.upc || "").trim();
    const limitedQty = String(body?.limitedQty || "").trim();
    const palletSize = String(body?.palletSize || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();
    const categories = expandCategoryTags(parseCategoriesFromBody(body)).slice(0, 1);
    const isNew = Boolean(body?.isNew);
    const justAdded = Boolean(body?.justAdded);
    const newItemDescription = String(body?.newItemDescription || "").trim();
    const newItemDescriptionPdfUrl = String(body?.newItemDescriptionPdfUrl || "").trim();
    const publishedInput =
      body?.newPublishedDate !== undefined
        ? String(body.newPublishedDate || "").trim()
        : "";
    const listPriceInput =
      body?.newItemListPrice !== undefined ? String(body.newItemListPrice || "").trim() : "";

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const existing: Product =
      (await redis.get<Product>(productRedisKey(sku))) ||
      ((catalogData as Product[]).find((item) => String(item.sku || "").toUpperCase() === sku) ?? { sku });

    const newItemStorageLabel =
      resolveNewItemStorageLabel({
        category: categories[0],
        categories,
        newItemStorageLabel: body?.newItemStorageLabel,
      }) ??
      mainCategoryToNewItemStorageLabel(mapLegacyCategoryToMain(existing.category || "")) ??
      parseNewItemStorageLabel(existing.newItemStorageLabel);

    const newPublishedDate =
      body?.newPublishedDate !== undefined
        ? publishedInput
          ? parseNewPublishedDate(publishedInput)
          : undefined
        : existing.newPublishedDate;

    const newItemListPrice =
      body?.newItemListPrice !== undefined
        ? normalizeNewItemListPrice(listPriceInput)
        : existing.newItemListPrice;

    if (publishedInput && !newPublishedDate) {
      return NextResponse.json(
        { error: "Invalid published date. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newSince = isNew ? existing.newSince || now : existing.newSince;

    const product: Product = {
      ...existing,
      sku,
      name,
      brand,
      status,
      size,
      barcode,
      upc,
      limitedQty,
      palletSize,
      imageUrl,
      categories: categories.length > 0 ? categories : undefined,
      category: categories.length > 0 ? categories[0] : undefined,
      isNew,
      justAdded,
      newSince,
      newPublishedDate,
      newItemListPrice,
      newItemDescription: newItemDescription || undefined,
      newItemDescriptionPdfUrl: newItemDescriptionPdfUrl || undefined,
      newItemStorageLabel,
      source: "Redis",
      updatedAt: now,
    };

    await saveRedisProduct(product);

    bustServerDataCache(SERVER_CACHE.catalog);
    bustServerDataCache(SERVER_CACHE.showcase);

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save product." },
      { status: 500 }
    );
  }
}