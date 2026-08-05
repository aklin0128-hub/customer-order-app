"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ShowcaseCard } from "@/app/components/ShowcaseCard";
import { readCustomerSession } from "@/lib/customerSession";
import type { ShowcaseData } from "@/lib/loginPreview";
import { queuePendingOrderSku } from "@/lib/pendingOrderIntent";

import "../showcase.css";
import "../components/out-of-stock-stamp.css";
import "../components/new-product-badge.css";
import "../components/coming-soon-badge.css";
import "./new.css";

type Lang = "en" | "zh" | "ko" | "vi";
type Tab = "promo" | "new";
export type ShowcaseVariant = "combined" | "promo";

const LANG_KEY = "showcase_lang";

const copy = {
  en: {
    brand: "Store Portal",
    title: "New & promotions",
    titlePromo: "Promotions",
    subtitle: "Browse our latest arrivals and promotions. Sign in to add to cart and order.",
    subtitlePromo: "Browse current promotions. Sign in to add to cart and order.",
    tabPromo: "Promotions",
    tabNew: "New items",
    signIn: "Sign in to order",
    emptyPromo: "No promotions right now. Check back soon.",
    emptyNew: "No new items right now.",
    updated: "Updated when you open this page",
    seeNew: "New items",
    seePromo: "Promotions",
  },
  zh: {
    brand: "门店订货",
    title: "新品 · 促销",
    titlePromo: "促销",
    subtitle: "无需登录即可浏览。登录后可加入购物车并提交订单。",
    subtitlePromo: "无需登录即可浏览促销。登录后可加入购物车并提交订单。",
    tabPromo: "促销",
    tabNew: "新品",
    signIn: "登录下单",
    emptyPromo: "暂无促销，请稍后再看。",
    emptyNew: "暂无新品。",
    updated: "打开页面时更新",
    seeNew: "新品",
    seePromo: "促销",
  },
  ko: {
    brand: "매장 주문",
    title: "신상품 · 프로모션",
    titlePromo: "프로모션",
    subtitle: "로그인 없이 둘러볼 수 있습니다. 로그인 후 장바구니에 담아 주문하세요.",
    subtitlePromo: "로그인 없이 프로모션을 둘러볼 수 있습니다. 로그인 후 장바구니에 담아 주문하세요.",
    tabPromo: "프로모션",
    tabNew: "신상품",
    signIn: "로그인 후 주문",
    emptyPromo: "프로모션이 없습니다.",
    emptyNew: "신상품이 없습니다.",
    updated: "페이지를 열 때 갱신됩니다",
    seeNew: "신상품",
    seePromo: "프로모션",
  },
  vi: {
    brand: "Cửa hàng",
    title: "Hàng mới · Khuyến mãi",
    titlePromo: "Khuyến mãi",
    subtitle: "Xem không cần đăng nhập. Đăng nhập để thêm vào giỏ và đặt hàng.",
    subtitlePromo: "Xem khuyến mãi không cần đăng nhập. Đăng nhập để thêm vào giỏ và đặt hàng.",
    tabPromo: "Khuyến mãi",
    tabNew: "Hàng mới",
    signIn: "Đăng nhập để đặt",
    emptyPromo: "Chưa có khuyến mãi.",
    emptyNew: "Chưa có hàng mới.",
    updated: "Cập nhật khi mở trang",
    seeNew: "Hàng mới",
    seePromo: "Khuyến mãi",
  },
};

const langLabels: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "VI",
};

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LANG_KEY) || localStorage.getItem("lang");
  if (saved === "zh" || saved === "ko" || saved === "vi" || saved === "en") return saved;
  return "en";
}

export default function PublicShowcaseClient({
  data,
  variant = "combined",
}: {
  data: ShowcaseData;
  variant?: ShowcaseVariant;
}) {
  const router = useRouter();
  const promoOnly = variant === "promo";
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>(promoOnly ? "promo" : "new");

  useEffect(() => {
    setLang(readLang());
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
    localStorage.setItem("lang", lang);
  }, [lang]);

  useEffect(() => {
    if (promoOnly) {
      setTab("promo");
      return;
    }
    if (data.newItemTotal === 0 && data.promotionTotal > 0) {
      setTab("promo");
    }
  }, [promoOnly, data.promotionTotal, data.newItemTotal]);

  const t = copy[lang];
  const activeTab = promoOnly ? "promo" : tab;
  const items = activeTab === "promo" ? data.promotions : data.newItems;
  const emptyText = activeTab === "promo" ? t.emptyPromo : t.emptyNew;
  const isEmpty = promoOnly
    ? data.promotionTotal === 0
    : data.promotionTotal === 0 && data.newItemTotal === 0;

  const queueSkuForOrder = (sku: string) => {
    const mode = activeTab === "promo" ? "promotion" : "newItems";
    queuePendingOrderSku(sku, { qty: "1", mode });
    if (readCustomerSession()?.accountNo) {
      router.push("/order");
      return;
    }
    router.push("/");
  };

  const langButtons = useMemo(
    () =>
      (["en", "zh", "ko", "vi"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          className={`new-lang-btn${lang === code ? " is-active" : ""}`}
          onClick={() => setLang(code)}
        >
          {langLabels[code]}
        </button>
      )),
    [lang]
  );

  return (
    <div className={`new-page${promoOnly ? " new-page--promo" : ""}`}>
      <header className="new-header">
        <div className="new-header-top">
          <div className="new-brand">
            <div className="new-logo" aria-hidden>
              RH
            </div>
            <span className="new-brand-text">{t.brand}</span>
          </div>
          <div className="new-lang-row" role="group" aria-label="Language">
            {langButtons}
          </div>
        </div>
        <h1 className="new-title">{promoOnly ? t.titlePromo : t.title}</h1>
        <p className="new-subtitle">{promoOnly ? t.subtitlePromo : t.subtitle}</p>
        <p className="new-updated">{t.updated}</p>
      </header>

      <main className="new-main">
        {isEmpty ? (
          <div className="new-empty-all">
            {promoOnly ? (
              <p>{t.emptyPromo}</p>
            ) : (
              <>
                <p>{t.emptyPromo}</p>
                <p>{t.emptyNew}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {promoOnly ? (
              data.promotionTotal > 0 ? (
                <div className="new-section-count" aria-live="polite">
                  {t.tabPromo} ({data.promotionTotal})
                </div>
              ) : null
            ) : (
              <div className="new-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "promo"}
                  className={`new-tab is-promo${tab === "promo" ? " is-active" : ""}`}
                  onClick={() => setTab("promo")}
                >
                  {t.tabPromo}
                  {data.promotionTotal > 0 ? ` (${data.promotionTotal})` : ""}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "new"}
                  className={`new-tab is-new${tab === "new" ? " is-active" : ""}`}
                  onClick={() => setTab("new")}
                >
                  {t.tabNew}
                  {data.newItemTotal > 0 ? ` (${data.newItemTotal})` : ""}
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div className="new-empty">{emptyText}</div>
            ) : (
              <div className="new-grid" role="list">
                {items.map((item) => (
                  <div key={item.sku} role="listitem" className="new-grid-item">
                    <ShowcaseCard
                      item={item}
                      lang={lang}
                      showPromo={activeTab === "promo"}
                      showNewDetails={activeTab === "new"}
                      showListPrice={false}
                      className="new-card"
                      orderActionDisabled={Boolean(item.newItemOutOfStock || item.newItemComingSoon)}
                      onOrderAction={() => queueSkuForOrder(item.sku)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="new-footer">
        <div className="new-footer-links">
          {promoOnly ? (
            <Link href="/new" className="new-secondary-link">
              {t.seeNew}
            </Link>
          ) : null}
          <Link href="/" className="new-sign-in-btn">
            {t.signIn}
          </Link>
        </div>
      </footer>
    </div>
  );
}
