"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Lang = "en" | "zh" | "ko";

const copy = {
  en: {
    title: "Customer Order",
    subtitle:
      "Sign in with your account number and password to start or continue your saved order.",
    accountNumber: "Account Number",
    password: "Password",
    accountPlaceholder: "e.g. FL111",
    passwordPlaceholder: "Enter password",
    signIn: "Sign In",
    signingIn: "Signing In...",
    invalid: "Invalid account number or password.",
    footer: "Online order portal · Save draft supported",
  },
  zh: {
    title: "客户订单",
    subtitle: "请输入客户账号和密码，开始下单或继续之前保存的订单。",
    accountNumber: "客户账号",
    password: "密码",
    accountPlaceholder: "例如 FL111",
    passwordPlaceholder: "请输入密码",
    signIn: "登录",
    signingIn: "登录中...",
    invalid: "客户账号或密码错误。",
    footer: "在线下单系统 · 支持保存草稿",
  },
  ko: {
    title: "고객 주문",
    subtitle:
      "거래처 번호와 비밀번호로 로그인하여 주문을 시작하거나 저장된 주문을 이어서 진행하세요.",
    accountNumber: "거래처 번호",
    password: "비밀번호",
    accountPlaceholder: "예: FL111",
    passwordPlaceholder: "비밀번호 입력",
    signIn: "로그인",
    signingIn: "로그인 중...",
    invalid: "거래처 번호 또는 비밀번호가 올바르지 않습니다.",
    footer: "온라인 주문 포털 · 임시 저장 지원",
  },
};

export default function LoginPage() {
  const router = useRouter();

  const [lang, setLang] = useState<Lang>("en");
  const [accountNo, setAccountNo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("lang") as Lang | null;
    if (savedLang === "en" || savedLang === "zh" || savedLang === "ko") {
      setLang(savedLang);
    }

    const savedAccount = localStorage.getItem("last_account_no");
    if (savedAccount) {
      setAccountNo(savedAccount.toUpperCase());
    }
  }, []);

  const t = copy[lang];

  const normalizedAccount = useMemo(
    () => accountNo.trim().toUpperCase(),
    [accountNo]
  );

  const changeLang = (next: Lang) => {
    setLang(next);
    localStorage.setItem("lang", next);
  };

  const handleLogin = async () => {
    if (loading) return;

    setError("");

    if (!normalizedAccount || !password.trim()) {
      setError(t.invalid);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          accountNo: normalizedAccount,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success || !data?.customer?.accountNo) {
        setError(data?.error || t.invalid);
        return;
      }

      sessionStorage.setItem("customer_logged_in", "true");
      sessionStorage.setItem("customer_account_no", data.customer.accountNo);
      sessionStorage.setItem("customer_store_name", data.customer.storeName || "");

      localStorage.setItem("last_account_no", data.customer.accountNo);

      router.push("/order");
    } catch {
      setError(t.invalid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef4ff 55%, #f8fafc 100%)",
        padding: "20px 12px 28px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <section
          style={{
            background: "#ffffff",
            borderRadius: 20,
            padding: "22px 18px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 18px 40px rgba(37,99,235,0.10)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 6,
              marginBottom: 16,
            }}
          >
            {(["en", "zh", "ko"] as Lang[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeLang(item)}
                style={{
                  border:
                    lang === item ? "1px solid #2563eb" : "1px solid #d1d5db",
                  background: lang === item ? "#eff6ff" : "#ffffff",
                  color: lang === item ? "#2563eb" : "#374151",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {item === "en" ? "EN" : item === "zh" ? "中文" : "한국어"}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                background: "#2563eb",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 21,
                boxShadow: "0 10px 24px rgba(37,99,235,0.25)",
                marginBottom: 12,
              }}
            >
              CO
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 27,
                fontWeight: 900,
                color: "#111827",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {t.title}
            </h1>

            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                fontSize: 13,
                lineHeight: 1.45,
                color: "#6b7280",
                maxWidth: 320,
              }}
            >
              {t.subtitle}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#374151",
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                {t.accountNumber}
              </label>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <input
                  value={accountNo}
                  onChange={(e) => {
                    setAccountNo(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                  placeholder={t.accountPlaceholder}
                  autoCapitalize="characters"
                  autoComplete="username"
                  style={{
                    width: "78%",
                    minWidth: 230,
                    maxWidth: 330,
                    padding: "12px 13px",
                    borderRadius: 13,
                    border: error ? "1px solid #fca5a5" : "1px solid #d1d5db",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                    textAlign: "center",
                    background: "#ffffff",
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#374151",
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                {t.password}
              </label>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin();
                  }}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  style={{
                    width: "78%",
                    minWidth: 230,
                    maxWidth: 330,
                    padding: "12px 13px",
                    borderRadius: 13,
                    border: error ? "1px solid #fca5a5" : "1px solid #d1d5db",
                    fontSize: 15,
                    outline: "none",
                    boxSizing: "border-box",
                    textAlign: "center",
                    background: "#ffffff",
                    fontWeight: 700,
                  }}
                />
              </div>
            </div>

            {error ? (
              <div
                style={{
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#b91c1c",
                }}
              >
                {error}
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                style={{
                  width: "46%",
                  minWidth: 140,
                  maxWidth: 190,
                  padding: "11px 0",
                  borderRadius: 13,
                  border: "none",
                  background: loading ? "#93c5fd" : "#2563eb",
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 8px 18px rgba(37,99,235,0.25)",
                }}
              >
                {loading ? t.signingIn : t.signIn}
              </button>
            </div>
          </div>
        </section>

        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#9ca3af",
            lineHeight: 1.45,
          }}
        >
          {t.footer}
        </div>
      </div>
    </main>
  );
}