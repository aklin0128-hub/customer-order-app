"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AdminGlobalSearchHandle } from "./AdminGlobalSearch";
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
import { AdminGlobalSearch } from "./AdminGlobalSearch";

export type AdminNav =
  | "home"
  | "customers"
  | "products"
  | "promotions"
  | "clearance"
  | "orders"
  | "invoices"
  | "topSkus"
  | "account"
  | "market"
  | "insights"
  | "activeCarts"
  | "inventory"
  | "priceCompare"
  | "weeklySales";

function NavLinks({ active, onNavigate }: { active: AdminNav; onNavigate?: () => void }) {
  return (
    <>
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
                onClick={onNavigate}
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
    </>
  );
}

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
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<AdminGlobalSearchHandle>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className="admin-shell" style={shell}>
      {navOpen ? (
        <button
          type="button"
          className="admin-nav-overlay"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        style={sidebar}
        className={`admin-sidebar${navOpen ? " admin-sidebar--open" : ""}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar-brand">
          <div style={logo} className="admin-sidebar-logo">
            RB
          </div>
          <div className="admin-brand-text">
            <div style={brandTitle}>Rhee Bros</div>
            <div style={brandSub}>Admin</div>
          </div>
          <button
            type="button"
            className="admin-nav-close"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="admin-nav-scroll">
          <NavLinks active={active} onNavigate={() => setNavOpen(false)} />
        </div>

        <button type="button" onClick={onLogout} className="admin-logout-btn">
          Sign out
        </button>
      </aside>

      <div style={mainArea} className="admin-main">
        <header className="admin-topbar" style={topBar}>
          <div className="admin-topbar-head">
            <button
              type="button"
              className="admin-menu-btn"
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              ☰
            </button>
            <div className="admin-topbar-titles">
              <h1 style={pageTitle}>{title}</h1>
              {subtitle ? <p style={pageSubtitle}>{subtitle}</p> : null}
            </div>
          </div>
          <div className="admin-topbar-actions" style={topActions}>
            <AdminGlobalSearch ref={searchRef} />
            {actions}
          </div>
        </header>

        <div style={content} className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
