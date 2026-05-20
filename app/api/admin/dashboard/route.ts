import { NextResponse } from "next/server";
import {
  getAdminDashboard,
  getAdminDashboardKpis,
  getAdminDashboardSections,
} from "@/lib/adminDashboard";
import { withTiming } from "@/lib/timingLog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const part = url.searchParams.get("part") || "all";

    if (part === "kpis") {
      const { result, ms } = await withTiming("dashboard.kpis", () => getAdminDashboardKpis());
      return NextResponse.json({ success: true, ...result, _timingMs: ms });
    }

    if (part === "sections") {
      const { result, ms } = await withTiming("dashboard.sections", () =>
        getAdminDashboardSections()
      );
      return NextResponse.json({ success: true, ...result, _timingMs: ms });
    }

    const { result, ms } = await withTiming("dashboard.all", () => getAdminDashboard());
    return NextResponse.json({ success: true, ...result, _timingMs: ms });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
