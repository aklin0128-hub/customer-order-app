"use client";

import { useState } from "react";
import { AdminLogin } from "@/app/admin/_components/AdminLogin";
import { CreditAuthProvider, useCreditAuth } from "@/app/payment/useCreditAuth";
import { CreditRequestClient } from "./CreditRequestClient";

function CreditPageInner() {
  const { ready, authed, error, loading, login, logout } = useCreditAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Sales Credit Request"
        subtitle="Enter password to open /credit."
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
    <main className="scr-page">
      <header className="scr-header">
        <div>
          <p className="scr-kicker">/credit</p>
          <h1 className="scr-title">Sales Credit Request</h1>
          <p className="scr-subtitle">Fill the form and save a PDF that matches the spreadsheet layout.</p>
        </div>
        <button type="button" className="scr-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="scr-body">
        <CreditRequestClient />
      </div>
    </main>
  );
}

export default function CreditPage() {
  return (
    <CreditAuthProvider>
      <CreditPageInner />
    </CreditAuthProvider>
  );
}
