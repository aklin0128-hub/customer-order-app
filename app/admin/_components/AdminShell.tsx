"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  brandSub,
  brandTitle,
  content,
  logo,
  mainArea,
  pageSubtitle,
  pageTitle,
  shell,
  sidebar,
  topActions,
  topBar,
} from "./admin-styles";
import { ADMIN_NAV_GROUPS } from "./admin-nav";

export type AdminNav =
  | "home"
  | "customers"
  | "products"
  | "promotions"
  | "clearance"
  | "orders"
  | "invoices"
  | "priceCompare"
  | "priceHistory"
  | "topSkus"
  | "market"
  | "insights"
  | "activeCarts";

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
    <div className="admin-shell" style={shell}>
      <aside style={sidebar} className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div style={logo}>RB</div>
          <div className="admin-brand-text">
            <div style={brandTitle}>Rhee Bros</div>
            <div style={brandSub}>Admin</div>
          </div>
        </div>

        <div className="admin-nav-scroll">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <span className="admin-nav-group-label">{group.title}</span>
              {group.items.map((item) => {
                const isActive = active === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`admin-nav-link${isActive ? " admin-nav-link--active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="admin-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="admin-nav-text">
                      <span className="admin-nav-label">{item.label}</span>
                      <span className="admin-nav-hint">{item.hint}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <button type="button" onClick={onLogout} className="admin-logout-btn">
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
