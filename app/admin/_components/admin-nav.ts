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
      { id: "clearance", label: "Near Date Sale", href: "/admin/clearance", hint: "Sell as is", icon: "⏳" },
      {
        id: "inventory",
        label: "Inventory & ETA",
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
      {
        id: "priceCompare",
        label: "Price Compare",
        href: "/admin/price-compare",
        hint: "Price history & buyers",
        icon: "💲",
      },
      { id: "insights", label: "Insights", href: "/admin/insights", hint: "Health · brands · price", icon: "💡" },
      { id: "market", label: "Market", href: "/admin/market", hint: "City growth", icon: "🌴" },
      {
        id: "weeklySales",
        label: "Weekly Sales",
        href: "/admin/weekly-sales-report",
        hint: "S70 report download",
        icon: "📋",
      },
      { id: "topSkus", label: "Top SKUs", href: "/admin/top-skus", hint: "Sales ranking", icon: "📊" },
      {
<<<<<<< HEAD
        id: "invoiceCompare",
        label: "Invoice Compare",
        href: "/comp",
        hint: "Same account price matrix",
        icon: "↔️",
=======
        id: "productSheet",
        label: "Product Sheet",
        href: "/admin/product-sheet",
        hint: "Custom picks → PDF",
        icon: "🗒",
>>>>>>> origin/cursor/product-sheet-pdf-0823
      },
    ],
  },
];

export const ADMIN_NAV_FLAT = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
