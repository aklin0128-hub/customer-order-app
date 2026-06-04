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
import { listOrderHistoryAccounts } from "@/lib/redisIndexes";
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
    invoicePricingCustomers: number;
  };
  alerts: DashboardAlert[];
  invoiceQuality: Awaited<ReturnType<typeof getInvoiceQualityStats>>;
  promoEffectiveness: Awaited<ReturnType<typeof getPromoEffectiveness>>;
  clearanceUrgent: Awaited<ReturnType<typeof getClearanceUrgency>>;
  cartFollowUps: Awaited<ReturnType<typeof getCartFollowUps>>;
  restockLeads: Awaited<ReturnType<typeof getRestockLeads>>;
};

export type AdminDashboardKpis = {
  kpis: AdminDashboardData["kpis"];
  alerts: DashboardAlert[];
};

export async function getAdminDashboardKpis(): Promise<AdminDashboardKpis> {
  const [
    health,
    customers,
    invoiceQuality,
    promos,
    clearance,
    cartStats,
    clearanceUrgent,
  ] = await Promise.all([
    getCustomerHealth(),
    getAllCustomers(),
    getInvoiceQualityStats(),
    getPromotionRecords(),
    getClearanceRecords(),
    getCartStats(),
    getClearanceUrgency(1),
  ]);

  const cutoff7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let ordersLast7Days = 0;
  const accounts = await listOrderHistoryAccounts();
  for (const accountNo of accounts) {
    const entries = (await redis.get<{ createdAt?: string }[]>(`orderHistory:${accountNo}`)) || [];
    for (const entry of entries) {
      const d = parseDate(entry.createdAt);
      if (d && d.getTime() >= cutoff7) ordersLast7Days += 1;
    }
  }

  const activePromotions = promos.filter((p) => getPromotionStatus(p) === "active").length;
  const activeClearance = clearance.filter((c) => getClearanceStatus(c) === "active").length;
  const unassignedRegions = customers.filter((c) => !c.region).length;
  const invoicePricingCustomers = customers.filter((c) => c.invoicePricing === true).length;

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
    invoicePricingCustomers,
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
      href: "/admin/customers?region=unassigned",
      tone: "warn",
    });
  }
  if (invoiceQuality.unknownSkuSet.length > 0) {
    alerts.push({
      id: "unknown_sku",
      label: "Unknown SKUs on invoices",
      count: invoiceQuality.unknownSkuSet.length,
      href: "/admin/invoices?q=unknown",
      tone: "warn",
    });
  }
  if (cartStats.staleCarts > 0) {
    alerts.push({
      id: "stale_carts",
      label: "Stale carts (3+ days)",
      count: cartStats.staleCarts,
      href: "/admin/active-carts?stale=1",
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
  if (invoicePricingCustomers > 0) {
    alerts.push({
      id: "invoice_pricing",
      label: "Invoice prices on order site",
      count: invoicePricingCustomers,
      href: "/admin/customers?invoicePricing=on",
      tone: "default",
    });
  }

  return { kpis, alerts };
}

export async function getAdminDashboardSections(): Promise<
  Omit<AdminDashboardData, "kpis" | "alerts">
> {
  const [customers, invoiceQuality, promoEffectiveness, clearanceUrgent, cartFollowUps, restockLeads] =
    await Promise.all([
      getAllCustomers(),
      getInvoiceQualityStats(),
      getPromoEffectiveness(6),
      getClearanceUrgency(6),
      getCartFollowUps(6),
      getRestockLeads(8),
    ]);

  const storeByAccount = new Map(customers.map((c) => [c.accountNo.toUpperCase(), c.storeName || ""]));
  for (const lead of restockLeads) {
    lead.storeName = storeByAccount.get(lead.accountNo) || "";
  }

  return {
    invoiceQuality,
    promoEffectiveness,
    clearanceUrgent,
    cartFollowUps,
    restockLeads,
  };
}

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const [{ kpis, alerts }, sections] = await Promise.all([
    getAdminDashboardKpis(),
    getAdminDashboardSections(),
  ]);
  return { kpis, alerts, ...sections };
}
