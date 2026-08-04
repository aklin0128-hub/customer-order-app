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
  rememberMe,
  onRememberMeChange,
  error,
  loading,
  onSubmit,
}: {
  title: string;
  subtitle: string;
  password: string;
  onPasswordChange: (v: string) => void;
<<<<<<< HEAD
  rememberMe: boolean;
  onRememberMeChange: (v: boolean) => void;
=======
  rememberMe?: boolean;
  onRememberMeChange?: (v: boolean) => void;
>>>>>>> origin/cursor/comp-password-login-0823
  error: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  const showRemember = typeof rememberMe === "boolean" && typeof onRememberMeChange === "function";

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
          autoComplete="current-password"
        />

<<<<<<< HEAD
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: "#374151",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => onRememberMeChange(e.target.checked)}
          />
          Remember me on this device
        </label>
=======
        {showRemember ? (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 13,
              fontWeight: 700,
              color: "#374151",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => onRememberMeChange(e.target.checked)}
            />
            Remember me on this device
          </label>
        ) : null}
>>>>>>> origin/cursor/comp-password-login-0823

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
