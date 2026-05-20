import { getAllCustomers } from "@/lib/customers";
import { getCustomerHealth } from "@/lib/customerHealth";
import { getPromotionRecords, getPromotionStatus } from "@/lib/promotions";
import { getClearanceRecords, getClearanceStatus } from "@/lib/clearance";
import { getInvoiceQualityStats } from "@/lib/invoiceQuality";
import {
  getPromoEffectiveness,
  getClearanceUrgency,
  getCartFollowUps,
  getRestockLeads,
  getCartStats,
} from "@/lib/businessInsights";
import { parseDate } from "@/lib/analyticsCommon";
import { redis } from "@/lib/redis";

export type DashboardAlert = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: "default" | "warn" | "danger";
};

export type AdminDashboardData = {
  kpis: {
    ordersLast7Days: number;
    atRiskCustomers: number;
    silentCustomers: number;
    unassignedRegions: number;
    invoicesLast30Days: number;
    unknownSkuCount: number;
    activePromotions: number;
    activeClearance: number;
    activeCarts: number;
    staleCarts: number;
  };
  alerts: DashboardAlert[];
  invoiceQuality: Awaited<ReturnType<typeof getInvoiceQualityStats>>;
  promoEffectiveness: Awaited<ReturnType<typeof getPromoEffectiveness>>;
  clearanceUrgent: Awaited<ReturnType<typeof getClearanceUrgency>>;
  cartFollowUps: Awaited<ReturnType<typeof getCartFollowUps>>;
  restockLeads: Awaited<ReturnType<typeof getRestockLeads>>;
};

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const [
    health,
    customers,
    invoiceQuality,
    promos,
    clearance,
    promoEffectiveness,
    clearanceUrgent,
    cartFollowUps,
    restockLeads,
    cartStats,
  ] = await Promise.all([
    getCustomerHealth(),
    getAllCustomers(),
    getInvoiceQualityStats(),
    getPromotionRecords(),
    getClearanceRecords(),
    getPromoEffectiveness(6),
    getClearanceUrgency(6),
    getCartFollowUps(6),
    getRestockLeads(8),
    getCartStats(),
  ]);

  const storeByAccount = new Map(customers.map((c) => [c.accountNo.toUpperCase(), c.storeName || ""]));
  for (const lead of restockLeads) {
    lead.storeName = storeByAccount.get(lead.accountNo) || "";
  }

  const cutoff7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let ordersLast7Days = 0;
  const historyKeys = await redis.keys("orderHistory:*");
  for (const key of historyKeys) {
    const entries = (await redis.get<{ createdAt?: string }[]>(key)) || [];
    for (const entry of entries) {
      const d = parseDate(entry.createdAt);
      if (d && d.getTime() >= cutoff7) ordersLast7Days += 1;
    }
  }

  const activePromotions = promos.filter((p) => getPromotionStatus(p) === "active").length;
  const activeClearance = clearance.filter((c) => getClearanceStatus(c) === "active").length;

  const unassignedRegions = customers.filter((c) => !c.region).length;

  const kpis = {
    ordersLast7Days,
    atRiskCustomers: health.summary.atRisk,
    silentCustomers: health.summary.silent,
    unassignedRegions,
    invoicesLast30Days: invoiceQuality.last30Days,
    unknownSkuCount: invoiceQuality.unknownSkuSet.length,
    activePromotions,
    activeClearance,
    activeCarts: cartStats.activeCarts,
    staleCarts: cartStats.staleCarts,
  };

  const alerts: DashboardAlert[] = [];

  if (health.summary.atRisk > 0) {
    alerts.push({
      id: "at_risk",
      label: "Customers at risk",
      count: health.summary.atRisk,
      href: "/admin/insights?status=at_risk",
      tone: "danger",
    });
  }
  if (unassignedRegions > 0) {
    alerts.push({
      id: "regions",
      label: "Missing city region",
      count: unassignedRegions,
      href: "/admin/customers",
      tone: "warn",
    });
  }
  if (invoiceQuality.unknownSkuSet.length > 0) {
    alerts.push({
      id: "unknown_sku",
      label: "Unknown SKUs on invoices",
      count: invoiceQuality.unknownSkuSet.length,
      href: "/admin/invoices",
      tone: "warn",
    });
  }
  if (cartStats.staleCarts > 0) {
    alerts.push({
      id: "stale_carts",
      label: "Stale carts (3+ days)",
      count: cartStats.staleCarts,
      href: "/admin/active-carts",
      tone: "warn",
    });
  }
  if (clearanceUrgent.length > 0) {
    alerts.push({
      id: "clearance",
      label: "Clearance expiring soon",
      count: clearanceUrgent.length,
      href: "/admin/clearance",
      tone: "warn",
    });
  }

  return {
    kpis,
    alerts,
    invoiceQuality,
    promoEffectiveness,
    clearanceUrgent,
    cartFollowUps,
    restockLeads,
  };
}
