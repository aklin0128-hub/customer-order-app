import {
  addUtcDays,
  buildCatalogMap,
  collectSaleEvents,
  dateInRange,
  formatDate,
  growthPct,
  sinceFromDays,
  startOfUtcDay,
} from "@/lib/analyticsCommon";

export type BrandInsightsDays = 30 | 90 | 180 | 365 | 0;

export type ShareSegment = {
  id: string;
  label: string;
  qty: number;
  revenue: number;
  sharePct: number;
  color: string;
  skuCount?: number;
};

export type SkuMoverRow = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  currentQty: number;
  previousQty: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
};

export type BrandInsightsResult = {
  days: BrandInsightsDays;
  groupBy: "brand" | "category";
  window: { start: string; end: string; label: string };
  previousWindow: { start: string; end: string; label: string };
  segments: ShareSegment[];
  topGroups: ShareSegment[];
  risingSkus: SkuMoverRow[];
  fallingSkus: SkuMoverRow[];
  summary: { totalQty: number; totalRevenue: number; skuCount: number };
};

const PIE_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
  "#9ca3af",
];

function windowForDays(days: BrandInsightsDays, now = new Date()) {
  const end = startOfUtcDay(now);
  if (days === 0) {
    return {
      start: null as Date | null,
      end,
      label: "All history",
    };
  }
  const start = sinceFromDays(days)!;
  return {
    start,
    end,
    label: `${formatDate(start)} → ${formatDate(end)}`,
  };
}

function previousWindow(start: Date | null, end: Date, days: BrandInsightsDays) {
  if (days === 0 || !start) {
    return { start: null as Date | null, end: null as Date | null, label: "—" };
  }
  const span = days;
  const prevEnd = addUtcDays(start, -1);
  const prevStart = addUtcDays(prevEnd, -span + 1);
  return {
    start: prevStart,
    end: prevEnd,
    label: `${formatDate(prevStart)} → ${formatDate(prevEnd)}`,
  };
}

export async function getBrandInsights(options: {
  days?: BrandInsightsDays;
  groupBy?: "brand" | "category";
}): Promise<BrandInsightsResult> {
  const days = options.days ?? 90;
  const groupBy = options.groupBy ?? "brand";
  const { start, end, label } = windowForDays(days);
  const prev = previousWindow(start, end, days);

  const scanStart = days === 0 ? null : prev.start || start;
  const allEvents = await collectSaleEvents({
    since: scanStart,
    until: end,
  });

  const currentEvents: typeof allEvents = [];
  const previousEvents: typeof allEvents = [];

  for (const e of allEvents) {
    const t = e.date.getTime();
    if (dateInRange(e.date, start, end)) currentEvents.push(e);
    if (prev.start && prev.end && dateInRange(e.date, prev.start, prev.end)) {
      previousEvents.push(e);
    }
  }

  const skus = new Set<string>();
  for (const e of allEvents) skus.add(e.sku);
  const catalog = await buildCatalogMap(Array.from(skus));

  const groupQty = new Map<string, { qty: number; revenue: number; skus: Set<string> }>();
  let totalQty = 0;
  let totalRevenue = 0;

  for (const e of currentEvents) {
    const product = catalog.get(e.sku);
    const key =
      groupBy === "brand"
        ? String(product?.brand || "Unknown brand").trim() || "Unknown brand"
        : String(product?.category || "Uncategorized").trim() || "Uncategorized";

    const row = groupQty.get(key) || { qty: 0, revenue: 0, skus: new Set() };
    row.qty += e.qty;
    row.revenue += e.revenue;
    row.skus.add(e.sku);
    groupQty.set(key, row);
    totalQty += e.qty;
    totalRevenue += e.revenue;
  }

  const sortedGroups = Array.from(groupQty.entries())
    .map(([label, row]) => ({
      id: label,
      label,
      qty: row.qty,
      revenue: Math.round(row.revenue * 100) / 100,
      sharePct: totalQty > 0 ? (row.qty / totalQty) * 100 : 0,
      skuCount: row.skus.size,
    }))
    .sort((a, b) => b.qty - a.qty);

  const topN = 8;
  const top = sortedGroups.slice(0, topN);
  const otherQty = sortedGroups.slice(topN).reduce((s, g) => s + g.qty, 0);
  const otherRev = sortedGroups.slice(topN).reduce((s, g) => s + g.revenue, 0);

  const segments: ShareSegment[] = top.map((g, i) => ({
    ...g,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  if (otherQty > 0) {
    segments.push({
      id: "__other__",
      label: "Other",
      qty: otherQty,
      revenue: Math.round(otherRev * 100) / 100,
      sharePct: totalQty > 0 ? (otherQty / totalQty) * 100 : 0,
      color: PIE_COLORS[8],
    });
  }

  const skuCurrent = new Map<string, number>();
  const skuPrevious = new Map<string, number>();
  for (const e of currentEvents) {
    skuCurrent.set(e.sku, (skuCurrent.get(e.sku) || 0) + e.qty);
  }
  for (const e of previousEvents) {
    skuPrevious.set(e.sku, (skuPrevious.get(e.sku) || 0) + e.qty);
  }

  const movers: SkuMoverRow[] = [];
  const allSkus = new Set([...skuCurrent.keys(), ...skuPrevious.keys()]);

  for (const sku of allSkus) {
    const currentQty = skuCurrent.get(sku) || 0;
    const previousQty = skuPrevious.get(sku) || 0;
    if (currentQty === 0 && previousQty === 0) continue;

    const change = growthPct(currentQty, previousQty);
    const product = catalog.get(sku);
    let direction: SkuMoverRow["direction"] = "flat";
    if (change !== null) {
      if (change > 5) direction = "up";
      else if (change < -5) direction = "down";
    } else if (currentQty > 0 && previousQty === 0) direction = "up";
    else if (currentQty === 0 && previousQty > 0) direction = "down";

    movers.push({
      sku,
      name: product?.name || "",
      brand: product?.brand || "",
      category: product?.category || "",
      currentQty,
      previousQty,
      changePct: change,
      direction,
    });
  }

  const risingSkus = movers
    .filter((m) => m.direction === "up" && m.currentQty >= 5)
    .sort((a, b) => (b.changePct ?? 999) - (a.changePct ?? 999))
    .slice(0, 15);

  const fallingSkus = movers
    .filter((m) => m.direction === "down" && m.previousQty >= 5)
    .sort((a, b) => (a.changePct ?? -999) - (b.changePct ?? -999))
    .slice(0, 15);

  return {
    days,
    groupBy,
    window: {
      start: start ? formatDate(start) : "",
      end: formatDate(end),
      label,
    },
    previousWindow: {
      start: prev.start ? formatDate(prev.start) : "",
      end: prev.end ? formatDate(prev.end) : "",
      label: prev.label,
    },
    segments,
    topGroups: sortedGroups.slice(0, 20).map((g, i) => ({
      ...g,
      color: PIE_COLORS[i % PIE_COLORS.length],
    })),
    risingSkus,
    fallingSkus,
    summary: {
      totalQty,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      skuCount: skuCurrent.size,
    },
  };
}
