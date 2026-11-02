"use client";

import { useState } from "react";
import { AdminLogin } from "@/app/admin/_components/AdminLogin";
import { InvoiceCompareClient } from "./InvoiceCompareClient";
import { CompAuthProvider, useCompAuth } from "./useCompAuth";

function CompPageInner() {
  const { ready, authed, error, loading, login, logout } = useCompAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Invoice Compare"
        subtitle="Enter password to open /comp."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        rememberMe={rememberMe}
        onRememberMeChange={setRememberMe}
        error={error}
        loading={loading}
        onSubmit={() => void login(passwordInput, rememberMe)}
      />
    );
  }

  return (
    <main className="comp-page">
      <header className="comp-header">
        <div>
          <p className="comp-kicker">/comp</p>
          <h1 className="comp-title">Invoice Compare</h1>
          <p className="comp-subtitle">
            Same account · side-by-side invoice prices by SKU · download CSV
          </p>
        </div>
        <button type="button" className="comp-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="comp-body">
        <InvoiceCompareClient />
      </div>
    </main>
  );
}

export default function CompPage() {
  return (
    <CompAuthProvider>
      <CompPageInner />
    </CompAuthProvider>
  );
}
