"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  brandSub,
  brandTitle,
  content,
  logo,
  logoutBtn,
  mainArea,
  nav,
  navHint,
  navLabel,
  navLink,
  navLinkActive,
  pageSubtitle,
  pageTitle,
  shell,
  sidebar,
  topActions,
  topBar,
} from "./admin-styles";

export type AdminNav = "home" | "customers" | "products" | "promotions" | "orders";

const NAV: { id: AdminNav; label: string; href: string; hint: string }[] = [
  { id: "home", label: "Dashboard", href: "/admin", hint: "Overview" },
  { id: "customers", label: "Customers", href: "/admin/customers", hint: "Login accounts" },
  { id: "products", label: "Products", href: "/admin/products", hint: "SKU settings" },
  { id: "promotions", label: "Promotions", href: "/admin/promotions", hint: "Featured sales" },
  { id: "orders", label: "Orders", href: "/admin/orders", hint: "Order history" },
];

export function AdminShell({
  active,
  title,
  subtitle,
  onLogout,
  children,
  actions,
}: {
  active: AdminNav;
  title: string;
  subtitle?: string;
  onLogout: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div style={shell} className="admin-shell">
      <aside style={sidebar} className="admin-sidebar">
        <div style={logo}>RB</div>
        <div style={brandTitle}>Rhee Bros</div>
        <div style={brandSub}>Admin</div>

        <nav style={nav}>
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              style={{
                ...navLink,
                ...(active === item.id ? navLinkActive : {}),
              }}
            >
              <span style={navLabel}>{item.label}</span>
              <span style={navHint}>{item.hint}</span>
            </Link>
          ))}
        </nav>

        <button type="button" onClick={onLogout} style={logoutBtn}>
          Sign out
        </button>
      </aside>

      <div style={mainArea}>
        <header style={topBar}>
          <div>
            <h1 style={pageTitle}>{title}</h1>
            {subtitle ? <p style={pageSubtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div style={topActions}>{actions}</div> : null}
        </header>

        <div style={content}>{children}</div>
      </div>
    </div>
  );
}
