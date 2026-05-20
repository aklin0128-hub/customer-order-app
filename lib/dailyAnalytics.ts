import { getAdminDashboard } from "@/lib/adminDashboard";
import { getCustomerHealth } from "@/lib/customerHealth";
import { redis } from "@/lib/redis";

const SNAPSHOT_KEY = "analytics:daily:latest";

export type DailyAnalyticsSnapshot = {
  savedAt: string;
  kpis: Awaited<ReturnType<typeof getAdminDashboard>>["kpis"];
  healthSummary: Awaited<ReturnType<typeof getCustomerHealth>>["summary"];
  alertCount: number;
};

export async function writeDailyAnalyticsSnapshot(): Promise<DailyAnalyticsSnapshot> {
  const [dashboard, health] = await Promise.all([getAdminDashboard(), getCustomerHealth()]);
  const snapshot: DailyAnalyticsSnapshot = {
    savedAt: new Date().toISOString(),
    kpis: dashboard.kpis,
    healthSummary: health.summary,
    alertCount: dashboard.alerts.length,
  };
  await redis.set(SNAPSHOT_KEY, snapshot);
  return snapshot;
}

export async function getLatestDailySnapshot() {
  return redis.get<DailyAnalyticsSnapshot>(SNAPSHOT_KEY);
}

export function formatDigestEmail(snapshot: DailyAnalyticsSnapshot) {
  const k = snapshot.kpis;
  const h = snapshot.healthSummary;
  return [
    `Rhee Bros Admin digest — ${snapshot.savedAt.slice(0, 10)}`,
    "",
    `Orders (7d): ${k.ordersLast7Days}`,
    `At risk: ${h.atRisk} · Silent: ${h.silent}`,
    `Stale carts: ${k.staleCarts} · Unknown SKUs: ${k.unknownSkuCount}`,
    `Active promos: ${k.activePromotions} · Clearance: ${k.activeClearance}`,
    "",
    `Open dashboard: ${process.env.NEXT_PUBLIC_APP_URL || ""}/admin`,
  ].join("\n");
}
