import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import catalogData from "@/data/catalog_sku_master_extracted.json";
import {
  hasXlsxProductIdentity,
  hasXlsxProductUpdate,
  parseProductFieldsFromXlsxRow,
  parseSkuFromXlsxRow,
} from "@/lib/catalogXlsxFields";
import { listRedisProductSkus, productRedisKey, saveRedisProduct } from "@/lib/productRedisStore";
import { redis } from "@/lib/redis";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Product = {
  sku: string;
  name?: string;
  name_k?: string;
  brand?: string;
  brand_k?: string;
  status?: string;
  size?: string;
  um?: string;
  upc?: string;
  palletSize?: string;
  inventory?: number;
  bp?: number;
  up?: number;
  cbm?: number;
  shelf_life_days?: number;
  storage_type?: string;
  country?: string;
  importedAt?: string;
  source?: string;
  updatedAt?: string;
};

type UploadPreview = {
  sku: string;
  status?: string;
  upc?: string;
  palletSize?: string;
  name?: string;
  inventory?: number;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function previewFromProduct(product: Product): UploadPreview {
  return {
    sku: product.sku,
    ...(product.status ? { status: product.status } : {}),
    ...(product.upc ? { upc: product.upc } : {}),
    ...(product.palletSize ? { palletSize: product.palletSize } : {}),
    ...(product.inventory !== undefined ? { inventory: product.inventory } : {}),
    ...(product.name ? { name: product.name } : {}),
  };
}

function formatPreviewLabel(item: UploadPreview) {
  const parts = [
    item.status,
    item.upc ? `UPC ${item.upc}` : "",
    item.palletSize ? `PL ${item.palletSize}` : "",
    item.inventory !== undefined ? `INV ${item.inventory}` : "",
    item.name ? item.name : "",
  ].filter(Boolean);
  return `${item.sku} → ${parts.join(" · ") || "—"}`;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Missing .xlsx file." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheetName = workbook.Sheets.Export ? "Export" : workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;

    if (!sheet) {
      return NextResponse.json({ error: "No worksheet found." }, { status: 400 });
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: true,
    });

    const knownSkus = new Set(
      (catalogData as { sku?: string }[])
        .map((item) => String(item.sku || "").trim().toUpperCase())
        .filter(Boolean)
    );
    for (const sku of await listRedisProductSkus()) {
      knownSkus.add(sku);
    }

    const updated: UploadPreview[] = [];
    const created: UploadPreview[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const sku = parseSkuFromXlsxRow(row);

      if (!sku) continue;

      if (sku.includes(" ")) {
        skipped.push(`${sku} (invalid SKU)`);
        continue;
      }

      const isKnown = knownSkus.has(sku);
      if (!isKnown && !hasXlsxProductIdentity(row)) {
        skipped.push(`${sku} (missing product data)`);
        continue;
      }
      if (isKnown && !hasXlsxProductUpdate(row)) {
        skipped.push(`${sku} (missing status/UPC/pallet/inventory)`);
        continue;
      }

      if (seen.has(sku)) continue;
      seen.add(sku);

      const fields = parseProductFieldsFromXlsxRow(row, sku);
      const now = new Date().toISOString();

      if (!isKnown) {
        const product: Product = {
          ...fields,
          sku,
          importedAt: now,
          source: "Redis",
          updatedAt: now,
        };

        await saveRedisProduct(product);
        knownSkus.add(sku);
        created.push(previewFromProduct(product));
        continue;
      }

      const existing = (await redis.get<Product>(productRedisKey(sku))) || { sku };
      const patch: Product = {
        ...existing,
        sku,
        source: "Redis",
        updatedAt: now,
      };
      if (fields.status) patch.status = fields.status;
      if (fields.upc) patch.upc = fields.upc;
      if (fields.palletSize) patch.palletSize = fields.palletSize;
      if (fields.inventory !== undefined) patch.inventory = fields.inventory;

      await saveRedisProduct(patch);
      updated.push(previewFromProduct(patch));
    }

    bustServerDataCache(SERVER_CACHE.catalog);
    bustServerDataCache(SERVER_CACHE.showcase);

    return NextResponse.json({
      success: true,
      sheetName,
      totalRows: rows.length,
      updatedCount: updated.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      updatedPreview: updated.slice(0, 20),
      createdPreview: created.slice(0, 20),
      skippedPreview: skipped.slice(0, 20),
      updatedPreviewLabels: updated.slice(0, 20).map(formatPreviewLabel),
      createdPreviewLabels: created.slice(0, 20).map(formatPreviewLabel),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload status XLSX." },
      { status: 500 }
    );
  }
}
