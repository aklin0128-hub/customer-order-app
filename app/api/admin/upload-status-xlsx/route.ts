import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import catalogData from "@/data/catalog_sku_master_extracted.json";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Product = {
  sku: string;
  status?: string;
  source?: string;
  updatedAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function safeString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getAny(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (safeString(value)) return safeString(value);
  }

  const normalized = new Map(
    Object.keys(row).map((key) => [key.trim().toUpperCase(), key])
  );

  for (const key of keys) {
    const actual = normalized.get(key.trim().toUpperCase());
    if (actual && safeString(row[actual])) return safeString(row[actual]);
  }

  return "";
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
      raw: false,
    });

    const knownSkus = new Set(
      (catalogData as { sku?: string }[])
        .map((item) => safeString(item.sku).toUpperCase())
        .filter(Boolean)
    );
    const redisProductKeys = await redis.keys("product:*");
    for (const key of redisProductKeys) {
      const sku = safeString(key).replace(/^product:/, "").toUpperCase();
      if (sku) knownSkus.add(sku);
    }

    const updated: { sku: string; status: string }[] = [];
    const unknown: string[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const sku = getAny(row, ["PID", "SKU", "Item No.", "Item No", "No.", "No", "Item", "Item Number"]).toUpperCase();
      const status = getAny(row, ["Status", "STATUS", "Item Status"]).toUpperCase();

      if (!sku || !status) {
        if (sku || status) skipped.push(sku || "(missing SKU)");
        continue;
      }

      if (seen.has(sku)) continue;
      seen.add(sku);

      if (!knownSkus.has(sku)) {
        unknown.push(sku);
        continue;
      }

      const existing = (await redis.get<Product>(`product:${sku}`)) || { sku };
      await redis.set(`product:${sku}`, {
        ...existing,
        sku,
        status,
        source: "Redis",
        updatedAt: new Date().toISOString(),
      });

      updated.push({ sku, status });
    }

    return NextResponse.json({
      success: true,
      sheetName,
      totalRows: rows.length,
      updatedCount: updated.length,
      unknownCount: unknown.length,
      skippedCount: skipped.length,
      updatedPreview: updated.slice(0, 20),
      unknownPreview: unknown.slice(0, 20),
      skippedPreview: skipped.slice(0, 20),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to upload status XLSX." },
      { status: 500 }
    );
  }
}
