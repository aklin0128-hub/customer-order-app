import { NextResponse } from "next/server";
import {
  formatDigestEmail,
  getLatestDailySnapshot,
  writeDailyAnalyticsSnapshot,
} from "@/lib/dailyAnalytics";
import { checkCronSecret } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getLatestDailySnapshot();
    return NextResponse.json({ success: true, snapshot });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to read snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const snapshot = await writeDailyAnalyticsSnapshot();
    const digest = formatDigestEmail(snapshot);
    return NextResponse.json({ success: true, snapshot, digest });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to write snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
