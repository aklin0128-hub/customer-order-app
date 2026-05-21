import { NextResponse } from "next/server";

import {
  bustInventoryCache,
  getSkuExpiration,
  loadInventoryLots,
  parseInventoryCsvText,
} from "@/lib/inventoryExpiry";
import { parseInventoryXlsxBuffer } from "@/lib/inventoryExpiryXlsx";
import {
  getInventoryCsvMeta,
  saveInventoryCsvUpload,
  summarizeInventoryRows,
} from "@/lib/inventoryExpiryStore";

function isInventorySpreadsheet(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

function isInventoryCsv(name: string) {
  return name.toLowerCase().endsWith(".csv");
}

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
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku") || "";

    const meta = await getInventoryCsvMeta();
    const rows = await loadInventoryLots();

    if (sku.trim()) {
      const status = url.searchParams.get("status") || undefined;
      const onlyFuture = url.searchParams.get("onlyFuture") === "1";
      const result = await getSkuExpiration(sku, { status, onlyFutureExpiry: onlyFuture });
      return NextResponse.json({
        success: true,
        meta,
        loadedRows: rows.length,
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      meta,
      loadedRows: rows.length,
      skuCount: meta?.skuCount ?? new Set(rows.map((r) => r.sku)).size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const name = String(file.name || "");
    if (!isInventoryCsv(name) && !isInventorySpreadsheet(name)) {
      return NextResponse.json(
        { error: "Upload a .csv or .xlsx file (By Item export)." },
        { status: 400 }
      );
    }

    let csvText: string;
    let rows;

    if (isInventorySpreadsheet(name)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      ({ csvText, rows } = parseInventoryXlsxBuffer(buffer));
    } else {
      csvText = await file.text();
      rows = parseInventoryCsvText(csvText);
    }
    const summary = summarizeInventoryRows(rows);

    const meta = await saveInventoryCsvUpload(csvText, summary, file.name);
    bustInventoryCache();

    return NextResponse.json({
      success: true,
      meta,
      message: `Uploaded ${summary.rowCount} lots · ${summary.skuCount} SKUs`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload inventory file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
