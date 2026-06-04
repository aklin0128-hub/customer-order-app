import type { AdminNav } from "./AdminShell";

export type AdminNavItem = {
  id: AdminNav;
  label: string;
  href: string;
  hint: string;
  icon: string;
};

export type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ id: "home", label: "Dashboard", href: "/admin", hint: "Overview", icon: "◆" }],
  },
  {
    title: "Store",
    items: [
      { id: "customers", label: "Customers", href: "/admin/customers", hint: "Login accounts", icon: "👥" },
      { id: "account", label: "Account 360", href: "/admin/account", hint: "One-store view", icon: "🔍" },
      { id: "activeCarts", label: "Active Carts", href: "/admin/active-carts", hint: "Draft carts", icon: "🛒" },
      { id: "orders", label: "Orders", href: "/admin/orders", hint: "Order history", icon: "🧾" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { id: "products", label: "Products", href: "/admin/products", hint: "SKU settings", icon: "📦" },
      { id: "promotions", label: "Promotions", href: "/admin/promotions", hint: "Featured sales", icon: "🏷️" },
      { id: "clearance", label: "Clearance", href: "/admin/clearance", hint: "Sell as is", icon: "⏳" },
      {
        id: "inventory",
        label: "Inventory expiry",
        href: "/admin/inventory",
        hint: "Weekly CSV/XLSX · SKU dates",
        icon: "📅",
      },
    ],
  },
  {
    title: "Reports",
    items: [
      { id: "invoices", label: "Invoices", href: "/admin/invoices", hint: "Import & quality", icon: "📄" },
      { id: "priceCompare", label: "Price Compare", href: "/admin/price-compare", hint: "Account vs SKU price", icon: "💲" },
      {
        id: "priceHistory",
        label: "Price History",
        href: "/admin/price-history",
        hint: "SKU price over time",
        icon: "📈",
      },
      { id: "insights", label: "Insights", href: "/admin/insights", hint: "Health · brands · price", icon: "💡" },
      { id: "market", label: "Market", href: "/admin/market", hint: "City growth", icon: "🌴" },
      { id: "topSkus", label: "Top SKUs", href: "/admin/top-skus", hint: "Rank · buyers", icon: "📊" },
    ],
  },
];

export const ADMIN_NAV_FLAT = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
