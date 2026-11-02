"use client";

import { useState } from "react";
import { AdminLogin } from "@/app/admin/_components/AdminLogin";
import { CreditClient } from "./CreditClient";
import { CreditAuthProvider, useCreditAuth } from "./useCreditAuth";

function CreditPageInner() {
  const { ready, authed, error, loading, login, logout } = useCreditAuth();
  const [passwordInput, setPasswordInput] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Credit / Deposit Slip"
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
    <main className="credit-page">
      <header className="credit-header">
        <div>
          <p className="credit-kicker">/credit</p>
          <h1 className="credit-title">Credit & Check Deposit</h1>
          <p className="credit-subtitle">
            Upload statement → pick debits/credits → apply check # / amount / date → PDF or Excel
          </p>
        </div>
        <button type="button" className="credit-logout" onClick={logout}>
          Log out
        </button>
      </header>
      <div className="credit-body">
        <CreditClient />
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
