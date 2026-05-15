"use client";

import Link from "next/link";
import {
  alertError,
  backLink,
  btnPrimary,
  inputStyle,
  labelStyle,
  loginCard,
  loginPage,
  loginSubtitle,
  loginTitle,
  logo,
} from "./admin-styles";

export function AdminLogin({
  title,
  subtitle,
  password,
  onPasswordChange,
  error,
  loading,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  password: string;
  onPasswordChange: (v: string) => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <main style={loginPage}>
      <section style={loginCard}>
        <div style={logo}>RB</div>
        <h1 style={loginTitle}>{title}</h1>
        <p style={loginSubtitle}>{subtitle}</p>

        <label style={labelStyle}>Admin password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Enter password"
          style={inputStyle}
          autoFocus
        />

        {error ? <div style={alertError}>{error}</div> : null}

        <button type="button" onClick={onSubmit} disabled={loading} style={{ ...btnPrimary, width: "100%", marginTop: 12 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <Link href="/" style={backLink}>
          Back to customer portal
        </Link>
      </section>
    </main>
  );
}
