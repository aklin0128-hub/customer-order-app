"use client";

import { useState } from "react";
import { AdminLogin } from "@/app/admin/_components/AdminLogin";
import { CompAuthProvider, useCompAuth } from "@/app/comp/useCompAuth";
import { PriceCompClient } from "./PriceCompClient";

function PriceCompPageInner() {
  const { ready, authed, error, loading, login, logout } = useCompAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Price Compare"
        subtitle="Enter password to open /price_comp. Same password as /comp."
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
          <p className="comp-kicker">/price_comp</p>
          <h1 className="comp-title">Price Compare</h1>
          <p className="comp-subtitle">
            Up to 7 customers · last invoice price by SKU · export CSV
          </p>
        </div>
        <button type="button" className="comp-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="comp-body">
        <PriceCompClient />
      </div>
    </main>
  );
}

export default function PriceCompPage() {
  return (
    <CompAuthProvider>
      <PriceCompPageInner />
    </CompAuthProvider>
  );
}
