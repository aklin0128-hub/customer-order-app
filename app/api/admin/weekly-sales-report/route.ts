import { NextResponse } from "next/server";

import { isMarketRegionId } from "@/lib/customerRegion";
import {
  applyWeeklySalesOverrides,
  buildWeeklySalesReport,
  defaultBiweeklyReportRange,
  type WeeklySalesReportInput,
} from "@/lib/weeklySalesReport";
import { weeklySalesReportToXlsxBuffer } from "@/lib/weeklySalesReportXlsx";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function parseInput(url: URL): WeeklySalesReportInput {
  const defaults = defaultBiweeklyReportRange();
  const region = String(url.searchParams.get("region") || "miami").trim().toLowerCase();
  if (!isMarketRegionId(region)) {
    throw new Error("Invalid region. Use miami, orlando, melbourne, or jacksonville.");
  }

  return {
    region,
    startDate: String(url.searchParams.get("start") || defaults.startDate).trim(),
    endDate: String(url.searchParams.get("end") || defaults.endDate).trim(),
    reportDate: String(url.searchParams.get("reportDate") || "").trim() || undefined,
    regionCode: String(url.searchParams.get("regionCode") || "SE").trim(),
    sid: String(url.searchParams.get("sid") || "832").trim(),
    visitArea: String(url.searchParams.get("visitArea") || "").trim() || undefined,
    marketOverview: String(url.searchParams.get("marketOverview") || "").trim(),
    productUpdate: String(url.searchParams.get("productUpdate") || "").trim(),
    competitorInsight: String(url.searchParams.get("competitorInsight") || "").trim(),
    suggestions: String(url.searchParams.get("suggestions") || "").trim(),
  };
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const format = String(url.searchParams.get("format") || "json").trim().toLowerCase();
    const input = parseInput(url);
    const report = await buildWeeklySalesReport(input);

    if (format === "xlsx") {
      const buffer = weeklySalesReportToXlsxBuffer(report);
      const stamp = input.endDate.replace(/-/g, "");
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="weekly-sales-report-${input.region}-${stamp}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, ...report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to build weekly sales report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const format = String(url.searchParams.get("format") || "xlsx").trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const base = parseInput(url);

    const input: WeeklySalesReportInput = {
      ...base,
      marketOverview: String(body?.marketOverview ?? base.marketOverview ?? "").trim(),
      productUpdate: String(body?.productUpdate ?? base.productUpdate ?? "").trim(),
      competitorInsight: String(body?.competitorInsight ?? base.competitorInsight ?? "").trim(),
      suggestions: String(body?.suggestions ?? base.suggestions ?? "").trim(),
      visitArea: String(body?.visitArea ?? base.visitArea ?? "").trim() || undefined,
      sid: String(body?.sid ?? base.sid ?? "832").trim(),
      regionCode: String(body?.regionCode ?? base.regionCode ?? "SE").trim(),
      reportDate: String(body?.reportDate ?? base.reportDate ?? "").trim() || undefined,
      startDate: String(body?.startDate ?? base.startDate).trim(),
      endDate: String(body?.endDate ?? base.endDate).trim(),
    };

    const report = applyWeeklySalesOverrides(
      await buildWeeklySalesReport(input),
      Array.isArray(body?.rows) ? body.rows : undefined
    );

    if (format === "json") {
      return NextResponse.json({ success: true, ...report });
    }

    const buffer = weeklySalesReportToXlsxBuffer(report);
    const stamp = input.endDate.replace(/-/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="weekly-sales-report-${input.region}-${stamp}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to build weekly sales report.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
