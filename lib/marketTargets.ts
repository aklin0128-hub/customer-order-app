import { type MarketRegionId, MARKET_REGIONS } from "@/lib/customerRegion";
import { redis } from "@/lib/redis";

const TARGETS_KEY = "market:targets:v1";

export type MarketRegionTarget = {
  region: MarketRegionId;
  label: string;
  /** Quarterly revenue target (USD) — manual entry */
  qTargetRevenue: number;
};

export type MarketTargetsPayload = {
  updatedAt: string;
  regions: MarketRegionTarget[];
};

const DEFAULT_TARGETS: MarketRegionTarget[] = MARKET_REGIONS.map((r) => ({
  region: r.id,
  label: r.label,
  qTargetRevenue: 0,
}));

export async function getMarketTargets(): Promise<MarketTargetsPayload> {
  const stored = await redis.get<MarketTargetsPayload>(TARGETS_KEY);
  if (stored?.regions?.length) return stored;
  return { updatedAt: "", regions: DEFAULT_TARGETS };
}

export async function saveMarketTargets(regions: MarketRegionTarget[]) {
  const payload: MarketTargetsPayload = {
    updatedAt: new Date().toISOString(),
    regions: regions.map((r) => ({
      region: r.region,
      label: r.label,
      qTargetRevenue: Math.max(0, Number(r.qTargetRevenue) || 0),
    })),
  };
  await redis.set(TARGETS_KEY, payload);
  return payload;
}
