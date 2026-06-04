"use client";

import { useState, type ReactNode } from "react";
import { AdminLogin } from "./AdminLogin";
import { AdminShell, type AdminNav } from "./AdminShell";
import { useAdminAuth } from "./AdminAuthContext";

export function AdminPage({
  active,
  title,
  subtitle,
  loginTitle,
  loginSubtitle,
  actions,
  children,
}: {
  active: AdminNav;
  title: string;
  subtitle?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { ready, authed, error, loading, login, logout } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title={loginTitle || title}
        subtitle={loginSubtitle || subtitle || "Sign in to continue."}
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => void login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell active={active} title={title} subtitle={subtitle} onLogout={logout} actions={actions}>
      {children}
    </AdminShell>
  );
}
