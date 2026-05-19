"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Lang = "en" | "zh" | "ko" | "vi";

const copy = {
  en: {
    title: "Store Ordering",
    subtitle: "Sign in for weekly picks, clearance deals, and easy ordering.",
    brandName: "Store Portal",
    accountNumber: "Account number",
    password: "Password",
    accountPlaceholder: "e.g. FL111",
    passwordPlaceholder: "Enter your password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    invalid: "Invalid account number or password.",
    emptyAccount: "Please enter your account number.",
    emptyPassword: "Please enter your password.",
    showPassword: "Show",
    hidePassword: "Hide",
    welcomeBack: "Welcome back",
    lastAccountHint: "Last signed-in account loaded.",
    footer: "Weekly picks · Clearance · Draft auto-save · EN / 中文 / 한국어 / Tiếng Việt",
    featPromo: "Weekly picks",
    featClearance: "Clearance",
    featCatalog: "Shop all",
    featSearch: "Quick replenish",
    featDraft: "Save draft",
  },
  zh: {
    title: "门店订货",
    subtitle: "登录查看本周主推、临期特价，轻松下单。",
    brandName: "门店订货",
    accountNumber: "客户账号",
    password: "密码",
    accountPlaceholder: "例如 FL111",
    passwordPlaceholder: "请输入密码",
    signIn: "登录",
    signingIn: "登录中…",
    invalid: "客户账号或密码错误。",
    emptyAccount: "请输入客户账号。",
    emptyPassword: "请输入密码。",
    showPassword: "显示",
    hidePassword: "隐藏",
    welcomeBack: "欢迎回来",
    lastAccountHint: "已填入上次登录的账号。",
    footer: "本周主推 · 临期特价 · 自动保存草稿 · 多语言",
    featPromo: "本周主推",
    featClearance: "临期特价",
    featCatalog: "全品选购",
    featSearch: "快速补货",
    featDraft: "保存草稿",
  },
  ko: {
    title: "매장 주문",
    subtitle: "로그인 후 이번 주 추천, 임박 특가를 확인하고 주문하세요.",
    brandName: "매장 주문",
    accountNumber: "거래처 번호",
    password: "비밀번호",
    accountPlaceholder: "예: FL111",
    passwordPlaceholder: "비밀번호 입력",
    signIn: "로그인",
    signingIn: "로그인 중…",
    invalid: "거래처 번호 또는 비밀번호가 올바르지 않습니다.",
    emptyAccount: "거래처 번호를 입력하세요.",
    emptyPassword: "비밀번호를 입력하세요.",
    showPassword: "표시",
    hidePassword: "숨기기",
    welcomeBack: "다시 오신 것을 환영합니다",
    lastAccountHint: "마지막 로그인 계정이 입력되었습니다.",
    footer: "이번 주 추천 · 임박 특가 · 임시 저장 · 다국어",
    featPromo: "이번 주 추천",
    featClearance: "임박 특가",
    featCatalog: "전체 상품",
    featSearch: "빠른 보충",
    featDraft: "임시 저장",
  },
  vi: {
    title: "Đặt hàng cửa hàng",
    subtitle: "Đăng nhập xem nổi bật tuần, hàng thanh lý và đặt hàng dễ dàng.",
    brandName: "Cổng đặt hàng",
    accountNumber: "Mã khách",
    password: "Mật khẩu",
    accountPlaceholder: "ví dụ FL111",
    passwordPlaceholder: "Nhập mật khẩu",
    signIn: "Đăng nhập",
    signingIn: "Đang đăng nhập…",
    invalid: "Sai mã khách hoặc mật khẩu.",
    emptyAccount: "Vui lòng nhập mã khách.",
    emptyPassword: "Vui lòng nhập mật khẩu.",
    showPassword: "Hiện",
    hidePassword: "Ẩn",
    welcomeBack: "Chào mừng trở lại",
    lastAccountHint: "Đã điền mã khách lần đăng nhập trước.",
    footer: "Nổi bật tuần · Thanh lý · Tự lưu nháp · Đa ngôn ngữ",
    featPromo: "Nổi bật tuần",
    featClearance: "Thanh lý",
    featCatalog: "Mua tất cả",
    featSearch: "Bổ hàng nhanh",
    featDraft: "Lưu nháp",
  },
};

const langLabels: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "Tiếng Việt",
};

export default function LoginPage() {
  const router = useRouter();
  const accountRef = useRef<HTMLInputElement>(null);

  const [lang, setLang] = useState<Lang>("en");
  const [accountNo, setAccountNo] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hadSavedAccount, setHadSavedAccount] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("customer_logged_in") === "true") {
      router.replace("/order");
      return;
    }
    setCheckingSession(false);

    const savedLang = localStorage.getItem("lang") as Lang | null;
    if (savedLang === "en" || savedLang === "zh" || savedLang === "ko" || savedLang === "vi") {
      setLang(savedLang);
    }

    const savedAccount = localStorage.getItem("last_account_no");
    if (savedAccount) {
      setAccountNo(savedAccount.toUpperCase());
      setHadSavedAccount(true);
    }
  }, [router]);

  useEffect(() => {
    if (!checkingSession) {
      accountRef.current?.focus();
    }
  }, [checkingSession]);

  const t = copy[lang];

  const normalizedAccount = useMemo(
    () => accountNo.trim().toUpperCase(),
    [accountNo]
  );

  const canSubmit = normalizedAccount.length > 0 && password.trim().length > 0 && !loading;

  const changeLang = (next: Lang) => {
    setLang(next);
    localStorage.setItem("lang", next);
  };

  const handleLogin = async () => {
    if (loading) return;

    setError("");

    if (!normalizedAccount) {
      setError(t.emptyAccount);
      accountRef.current?.focus();
      return;
    }

    if (!password.trim()) {
      setError(t.emptyPassword);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (checkingSession) {
    return (
      <main style={pageStyle}>
        <div style={{ ...cardStyle, padding: 32, textAlign: "center", color: "#6b7280", fontSize: 14, fontWeight: 700 }}>
          …
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={topBarStyle}>
          <div style={brandRowStyle}>
            <div style={logoMarkStyle}>CO</div>
            <span style={brandTextStyle}>{t.brandName}</span>
          </div>
          <div style={langRowStyle} role="group" aria-label="Language">
            {(["en", "zh", "ko", "vi"] as Lang[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeLang(item)}
                aria-pressed={lang === item}
                style={langBtnStyle(lang === item)}
              >
                {langLabels[item]}
              </button>
            ))}
          </div>
        </header>

        <section style={cardStyle}>
          <div style={heroStyle}>
            <h1 style={titleStyle}>{t.title}</h1>
            <p style={subtitleStyle}>{t.subtitle}</p>
          </div>

          <div style={featuresStyle}>
            {[
              { label: t.featPromo, icon: "★" },
              { label: t.featClearance, icon: "⏱" },
              { label: t.featCatalog, icon: "▦" },
              { label: t.featSearch, icon: "⌕" },
              { label: t.featDraft, icon: "✓" },
            ].map((f) => (
              <div key={f.label} style={featureChipStyle}>
                <span style={featureIconStyle} aria-hidden>
                  {f.icon}
                </span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          {hadSavedAccount && normalizedAccount ? (
            <div style={welcomeBannerStyle}>
              <strong>{t.welcomeBack}</strong>
              <span style={{ opacity: 0.85 }}> · {normalizedAccount}</span>
              <div style={{ display: "block", fontSize: 11, fontWeight: 600, marginTop: 2, opacity: 0.75 }}>
                {t.lastAccountHint}
              </div>
            </div>
          ) : null}

          <form
            style={formStyle}
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div style={fieldStyle}>
              <label htmlFor="account-no" style={labelStyle}>
                {t.accountNumber}
              </label>
              <input
                id="account-no"
                ref={accountRef}
                value={accountNo}
                onChange={(e) => {
                  setAccountNo(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder={t.accountPlaceholder}
                autoCapitalize="characters"
                autoComplete="username"
                enterKeyHint="next"
                style={inputStyle(Boolean(error && !normalizedAccount))}
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="password" style={labelStyle}>
                {t.password}
              </label>
              <div style={passwordWrapStyle}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  style={{ ...inputStyle(Boolean(error && normalizedAccount)), paddingRight: 72 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={togglePasswordStyle}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                >
                  {showPassword ? t.hidePassword : t.showPassword}
                </button>
              </div>
            </div>

            {error ? (
              <div style={errorBoxStyle} role="alert">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={!canSubmit} style={submitBtnStyle(!canSubmit)}>
              {loading ? t.signingIn : t.signIn}
            </button>
          </form>
        </section>

        <p style={footerStyle}>{t.footer}</p>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(37,99,235,0.12), transparent), linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)",
  padding: "max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
};

const shellStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 2px",
};

const brandRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const logoMarkStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 14,
  boxShadow: "0 6px 16px rgba(37,99,235,0.28)",
  flexShrink: 0,
};

const brandTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
  letterSpacing: "-0.01em",
};

const langRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  padding: 3,
  background: "#ffffff",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

function langBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    background: active ? "#2563eb" : "transparent",
    color: active ? "#ffffff" : "#6b7280",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  };
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 22,
  padding: "22px 20px 20px",
  border: "1px solid #e5e7eb",
  boxShadow: "0 20px 48px rgba(15,23,42,0.08), 0 4px 12px rgba(37,99,235,0.06)",
};

const heroStyle: React.CSSProperties = {
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.15,
  letterSpacing: "-0.03em",
};

const subtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  lineHeight: 1.5,
  color: "#6b7280",
};

const featuresStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  marginBottom: 18,
};

const featureChipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 10px",
  borderRadius: 12,
  background: "#f8fafc",
  border: "1px solid #eef2f7",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
};

const featureIconStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 8,
  background: "#eff6ff",
  color: "#2563eb",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  flexShrink: 0,
};

const welcomeBannerStyle: React.CSSProperties = {
  marginBottom: 14,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  fontSize: 13,
  fontWeight: 700,
  color: "#1e40af",
  lineHeight: 1.4,
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
};

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 14px",
    borderRadius: 12,
    border: hasError ? "1px solid #f87171" : "1px solid #d1d5db",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
    fontWeight: 600,
    color: "#111827",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
}

const passwordWrapStyle: React.CSSProperties = {
  position: "relative",
};

const togglePasswordStyle: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "#f3f4f6",
  color: "#4b5563",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const errorBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  fontSize: 13,
  fontWeight: 700,
  color: "#b91c1c",
  lineHeight: 1.4,
};

function submitBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    marginTop: 4,
    padding: "14px 16px",
    borderRadius: 14,
    border: "none",
    background: disabled ? "#cbd5e1" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 10px 22px rgba(37,99,235,0.28)",
    letterSpacing: "-0.01em",
  };
}

const footerStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 11,
  color: "#9ca3af",
  lineHeight: 1.5,
  padding: "0 8px",
};
