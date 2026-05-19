"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLogin } from "./_components/AdminLogin";
import { AdminShell } from "./_components/AdminShell";
import { panel, panelTitle } from "./_components/admin-styles";
import { useAdminAuth } from "./_components/useAdminAuth";

const QUICK_LINKS = [
  {
    title: "Customers",
    description: "Add or edit store login accounts, passwords, and active status.",
    href: "/admin/customers",
    emoji: "👥",
  },
  {
    title: "Products",
    description: "Update SKU status, categories, limits, and product photos.",
    href: "/admin/products",
    emoji: "📦",
  },
  {
    title: "Promotions",
    description: "Feature sales SKUs on the customer Promotions tab.",
    href: "/admin/promotions",
    emoji: "🏷️",
  },
  {
    title: "Clearance",
    description: "Near-expiry sell-as-is items with expiry date and clearance price.",
    href: "/admin/clearance",
    emoji: "⏳",
  },
  {
    title: "Active Carts",
    description: "See which customer accounts currently have unsent items saved in their cart.",
    href: "/admin/active-carts",
    emoji: "🛒",
  },
  {
    title: "Invoices",
    description: "Upload customer invoices (PDF or image). Lines are parsed into SKUs and quantities; optionally feed recent items & order history.",
    href: "/admin/invoices",
    emoji: "📄",
  },
  {
    title: "Price History",
    description: "Check one account's historical invoice unit price for a SKU.",
    href: "/admin/price-history",
    emoji: "📈",
  },
  {
    title: "SKU Buyers",
    description: "See which accounts bought a SKU the most over a selected period.",
    href: "/admin/sku-buyers",
    emoji: "🏆",
  },
  {
    title: "Orders",
    description: "Browse recent submitted orders and download CSV files.",
    href: "/admin/orders",
    emoji: "🧾",
  },
];

export default function AdminDashboardPage() {
  const { ready, authed, error, loading, login, logout } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  useEffect(() => {
    if (ready && authed) setPasswordInput("");
  }, [ready, authed]);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Admin sign in"
        subtitle="One login for customers, products, and orders. Your session stays open until you sign out."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell
      active="home"
      title="Dashboard"
      subtitle="Quick access to everything you manage."
      onLogout={logout}
    >
      <section style={panel}>
        <h2 style={panelTitle}>What do you want to do?</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginTop: 4,
          }}
        >
          {QUICK_LINKS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 18,
                textDecoration: "none",
                color: "inherit",
                background: "#fafafa",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{card.emoji}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{card.title}</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
                {card.description}
              </p>
              <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: "#2563eb" }}>Open →</div>
            </Link>
          ))}
        </div>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>Tips</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: "#374151", fontSize: 13, lineHeight: 1.6 }}>
          <li>Customer logins saved in Redis override the CSV file used for legacy accounts.</li>
          <li>Product changes in Redis appear on the order page after refresh.</li>
          <li>Orders are stored per customer (last 20). Email copies go out when customers submit.</li>
        </ul>
      </section>
    </AdminShell>
  );
}
