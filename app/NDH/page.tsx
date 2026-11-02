"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductImage } from "@/app/order/components/ProductImage";
import { formatClearancePriceDisplay } from "@/lib/clearanceFormat";

import "../showcase.css";
import "../new/new.css";

type Lang = "en" | "zh" | "ko" | "vi";

type NdhItem = {
  sku: string;
  name?: string;
  brand?: string;
  size?: string;
  imageUrl?: string;
  clearanceNote?: string;
  clearancePrice?: string;
  expiryDate?: string;
  remainingQty?: number | null;
  daysUntilExpiry?: number | null;
};

const LANG_KEY = "showcase_lang";

const copy = {
  en: {
    brand: "Store Portal",
    title: "NDH",
    subtitle: "Near-date items — sell as is. Sign in to add cases on the order page.",
    signIn: "Sign in to order",
    openOrder: "Open NDH on order page",
    empty: "No NDH items right now.",
    loading: "Loading NDH…",
    expiry: "Expires",
    left: "Left",
    sellAsIs: "SELL AS IS",
    noReturn: "No return · No refund",
    daysLeft: "{days} days left",
  },
  zh: {
    brand: "门店订货",
    title: "NDH",
    subtitle: "临期商品，售出不退。登录后可在订货页加箱。",
    signIn: "登录下单",
    openOrder: "打开订货页 NDH",
    empty: "暂无 NDH 商品。",
    loading: "正在加载 NDH…",
    expiry: "到期",
    left: "剩余",
    sellAsIs: "售出不退",
    noReturn: "不退不换",
    daysLeft: "剩余 {days} 天",
  },
  ko: {
    brand: "매장 주문",
    title: "NDH",
    subtitle: "임박 상품, 판매 후 반품 불가. 로그인 후 주문 페이지에서 담으세요.",
    signIn: "로그인 후 주문",
    openOrder: "주문 페이지에서 NDH 열기",
    empty: "NDH 상품이 없습니다.",
    loading: "NDH 불러오는 중…",
    expiry: "만료",
    left: "남은 수량",
    sellAsIs: "판매 후 반품 불가",
    noReturn: "반품·환불 불가",
    daysLeft: "{days}일 남음",
  },
  vi: {
    brand: "Cửa hàng",
    title: "NDH",
    subtitle: "Hàng cận date, bán là xong. Đăng nhập để đặt trên trang order.",
    signIn: "Đăng nhập để đặt",
    openOrder: "Mở NDH trên trang đặt hàng",
    empty: "Chưa có hàng NDH.",
    loading: "Đang tải NDH…",
    expiry: "Hết hạn",
    left: "Còn",
    sellAsIs: "BÁN NGUYÊN TRẠNG",
    noReturn: "Không đổi trả",
    daysLeft: "còn {days} ngày",
  },
} as const;

export default function NdhPublicPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [items, setItems] = useState<NdhItem[]>([]);
  const [loading, setLoading] = useState(true);
  const t = copy[lang];

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved === "en" || saved === "zh" || saved === "ko" || saved === "vi") setLang(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/ndh", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data.products)) {
          setItems(data.products as NdhItem[]);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeLang = (next: Lang) => {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  return (
    <div className="new-page">
      <header className="new-top">
        <div className="new-brand">{t.brand}</div>
        <div className="new-lang" role="group" aria-label="Language">
          {(["en", "zh", "ko", "vi"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={`new-lang-btn${lang === code ? " is-active" : ""}`}
              onClick={() => changeLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="new-main">
        <h1 className="new-title">{t.title}</h1>
        <p className="new-subtitle">{t.subtitle}</p>

        {loading ? (
          <p className="new-empty">{t.loading}</p>
        ) : items.length === 0 ? (
          <p className="new-empty">{t.empty}</p>
        ) : (
          <div className="showcase-grid" style={{ marginTop: 16 }}>
            {items.map((item) => {
              const soldOut = item.remainingQty === 0;
              const days =
                item.daysUntilExpiry != null && item.daysUntilExpiry > 0
                  ? t.daysLeft.replace("{days}", String(item.daysUntilExpiry))
                  : "";
              return (
                <article
                  key={item.sku}
                  className="showcase-card"
                  style={{
                    border: "1px solid #fdba74",
                    background: "#fff7ed",
                    opacity: soldOut ? 0.65 : 1,
                  }}
                >
                  <ProductImage sku={item.sku} alt={item.name || item.sku} size={80} imageUrl={item.imageUrl} />
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{item.sku}</div>
                  <div style={{ fontSize: 12, color: "#9a3412", fontWeight: 800 }}>{t.sellAsIs}</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>
                    {item.brand ? `${item.brand} · ` : ""}
                    {item.name || ""}
                    {item.size ? ` · ${item.size}` : ""}
                  </div>
                  {item.clearancePrice ? (
                    <div style={{ fontWeight: 900, color: "#c2410c" }}>
                      {formatClearancePriceDisplay(item.clearancePrice)}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {item.expiryDate ? `${t.expiry} ${item.expiryDate}` : ""}
                    {days ? ` · ${days}` : ""}
                    {item.remainingQty != null ? ` · ${t.left} ${item.remainingQty}` : ""}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#9a3412" }}>{t.noReturn}</div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="new-footer">
        <div className="new-footer-links">
          <Link href="/order?mode=ndh" className="new-secondary-link">
            {t.openOrder}
          </Link>
          <Link href="/" className="new-sign-in-btn">
            {t.signIn}
          </Link>
        </div>
      </footer>
    </div>
  );
}
