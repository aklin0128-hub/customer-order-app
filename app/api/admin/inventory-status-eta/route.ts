import { NextResponse } from "next/server";

import {
  parseStatusEtaCsvText,
  serializeStatusEtaProductsToCsv,
  summarizeStatusEtaProducts,
} from "@/lib/inventoryStatusEta";
import { parseStatusEtaXlsxBuffer } from "@/lib/inventoryStatusEtaXlsx";
import {
  getStatusEtaCsvMeta,
  loadStatusEtaProducts,
  saveStatusEtaUpload,
} from "@/lib/inventoryStatusEtaStore";

export const dynamic = "force-dynamic";

function isSpreadsheet(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls");
}

function isCsv(name: string) {
  return name.toLowerCase().endsWith(".csv");
}

export async function GET() {
  try {
    const meta = await getStatusEtaCsvMeta();
    const products = await loadStatusEtaProducts();
    return NextResponse.json({
      success: true,
      meta,
      skuCount: meta?.skuCount ?? products.length,
      rowCount: meta?.rowCount ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load status/ETA inventory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file?.size) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const fileName = file.name || "status-eta.xlsx";
    let products;

    if (isSpreadsheet(fileName)) {
      const buffer = Buffer.from(await file.arrayBuffer());
      products = parseStatusEtaXlsxBuffer(buffer);
    } else if (isCsv(fileName)) {
      const text = await file.text();
      products = parseStatusEtaCsvText(text);
    } else {
      return NextResponse.json(
        { error: "Upload an .xlsx, .xls, or .csv file." },
        { status: 400 }
      );
    }

    const stats = summarizeStatusEtaProducts(products);
    const withAvailableInv = products.filter((p) => p.availableInv != null).length;
    const csvText = serializeStatusEtaProductsToCsv(products);
    const meta = await saveStatusEtaUpload(csvText, products, stats, fileName);

    const avalNote =
      stats.skuCount > 0 && withAvailableInv === 0
        ? " Warning: Aval. INV is empty for all PIDs — re-export Excel (keep merged Aval. INV cells) and upload again."
        : stats.skuCount > 0 && withAvailableInv < stats.skuCount * 0.2
          ? ` Warning: Aval. INV filled on only ${withAvailableInv}/${stats.skuCount} PIDs.`
          : "";

    return NextResponse.json({
      success: true,
      meta,
      availableInvCount: withAvailableInv,
      message: `Uploaded ${stats.skuCount} SKUs (${stats.rowCount} rows).${avalNote}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
