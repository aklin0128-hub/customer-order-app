/** Florida metro regions for customer assignment and market reporting. */

export const MARKET_REGIONS = [
  { id: "miami", label: "Miami" },
  { id: "orlando", label: "Orlando" },
  { id: "melbourne", label: "Melbourne" },
  { id: "jacksonville", label: "Jacksonville" },
] as const;

export type MarketRegionId = (typeof MARKET_REGIONS)[number]["id"];

export const UNASSIGNED_REGION = "unassigned" as const;

export type CustomerRegionValue = MarketRegionId | typeof UNASSIGNED_REGION;

export function normalizeMarketRegion(value: unknown): MarketRegionId | undefined {
  const id = String(value || "")
    .trim()
    .toLowerCase();
  if (!id) return undefined;
  return MARKET_REGIONS.some((r) => r.id === id) ? (id as MarketRegionId) : undefined;
}

export function marketRegionLabel(region: string | undefined): string {
  if (!region || region === UNASSIGNED_REGION) return "Unassigned";
  const found = MARKET_REGIONS.find((r) => r.id === region);
  return found?.label || region;
}

export function isMarketRegionId(value: string): value is MarketRegionId {
  return MARKET_REGIONS.some((r) => r.id === value);
}
