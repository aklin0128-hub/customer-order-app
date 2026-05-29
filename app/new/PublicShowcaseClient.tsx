"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ShowcaseCard } from "@/app/components/ShowcaseCard";
import type { ShowcaseData } from "@/lib/loginPreview";

import "../showcase.css";
import "./new.css";

type Lang = "en" | "zh" | "ko" | "vi";
type Tab = "promo" | "new";

const LANG_KEY = "showcase_lang";

const copy = {
  en: {
    brand: "Store Portal",
    title: "New & weekly picks",
    subtitle: "Browse our latest arrivals and promotions. Sign in to add to cart and order.",
    tabPromo: "Weekly picks",
    tabNew: "New items",
    signIn: "Sign in to order",
    emptyPromo: "No weekly picks right now. Check back soon.",
    emptyNew: "No new items right now.",
    updated: "Updated when you open this page",
  },
  zh: {
    brand: "门店订货",
    title: "新品 · 本周主推",
    subtitle: "无需登录即可浏览。登录后可加入购物车并提交订单。",
    tabPromo: "本周主推",
    tabNew: "新品",
    signIn: "登录下单",
    emptyPromo: "暂无本周主推，请稍后再看。",
    emptyNew: "暂无新品。",
    updated: "打开页面时更新",
  },
  ko: {
    brand: "매장 주문",
    title: "신상품 · 이번 주 추천",
    subtitle: "로그인 없이 둘러볼 수 있습니다. 로그인 후 장바구니에 담아 주문하세요.",
    tabPromo: "이번 주 추천",
    tabNew: "신상품",
    signIn: "로그인 후 주문",
    emptyPromo: "이번 주 추천이 없습니다.",
    emptyNew: "신상품이 없습니다.",
    updated: "페이지를 열 때 갱신됩니다",
  },
  vi: {
    brand: "Cửa hàng",
    title: "Hàng mới · Nổi bật tuần",
    subtitle: "Xem không cần đăng nhập. Đăng nhập để thêm vào giỏ và đặt hàng.",
    tabPromo: "Nổi bật tuần",
    tabNew: "Hàng mới",
    signIn: "Đăng nhập để đặt",
    emptyPromo: "Chưa có nổi bật tuần.",
    emptyNew: "Chưa có hàng mới.",
    updated: "Cập nhật khi mở trang",
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
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "zh" || saved === "ko" || saved === "vi" || saved === "en") return saved;
  return "en";
}

export default function PublicShowcaseClient({ data }: { data: ShowcaseData }) {
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>("new");

  useEffect(() => {
    setLang(readLang());
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    if (data.newItemTotal === 0 && data.promotionTotal > 0) {
      setTab("promo");
    }
  }, [data.promotionTotal, data.newItemTotal]);

  const t = copy[lang];
  const items = tab === "promo" ? data.promotions : data.newItems;
  const total = tab === "promo" ? data.promotionTotal : data.newItemTotal;
  const emptyText = tab === "promo" ? t.emptyPromo : t.emptyNew;
  const justAddedBadgeText =
    lang === "zh" ? "刚刚上架" : lang === "ko" ? "방금 등록" : lang === "vi" ? "MỚI THÊM" : "JUST ADDED";
  const isEmpty = data.promotionTotal === 0 && data.newItemTotal === 0;

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
    <div className="new-page">
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
        <h1 className="new-title">{t.title}</h1>
        <p className="new-subtitle">{t.subtitle}</p>
        <p className="new-updated">{t.updated}</p>
      </header>

      <main className="new-main">
        {isEmpty ? (
          <div className="new-empty-all">
            <p>{t.emptyPromo}</p>
            <p>{t.emptyNew}</p>
          </div>
        ) : (
          <>
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

            {items.length === 0 ? (
              <div className="new-empty">{emptyText}</div>
            ) : (
              <div className="new-grid" role="list">
                {items.map((item) => (
                  <ShowcaseCard
                    key={item.sku}
                    item={item}
                    lang={lang}
                    showPromo={tab === "promo"}
                    showNewDetails={tab === "new"}
                    className="new-card"
                    badge={tab === "new" ? justAddedBadgeText : null}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="new-footer">
        <Link href="/" className="new-sign-in-btn">
          {t.signIn}
        </Link>
      </footer>
    </div>
  );
}
