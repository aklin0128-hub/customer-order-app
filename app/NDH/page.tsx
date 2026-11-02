"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CatalogQtyCard } from "@/app/order/components/CatalogQtyCard";
import { formatClearanceDetails } from "@/app/order/catalogUtils";
import { copy as orderCopy } from "@/app/order/orderCopy";
import type { ClearanceItem, Lang } from "@/app/order/types";

import "../new/new.css";
import "../order/order.css";
import "./ndh-public.css";

type NdhItem = ClearanceItem;

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
  },
  zh: {
    brand: "门店订货",
    title: "NDH",
    subtitle: "临期商品，售出不退。登录后可在订货页加箱。",
    signIn: "登录下单",
    openOrder: "打开订货页 NDH",
    empty: "暂无 NDH 商品。",
    loading: "正在加载 NDH…",
  },
  ko: {
    brand: "매장 주문",
    title: "NDH",
    subtitle: "임박 상품, 판매 후 반품 불가. 로그인 후 주문 페이지에서 담으세요.",
    signIn: "로그인 후 주문",
    openOrder: "주문 페이지에서 NDH 열기",
    empty: "NDH 상품이 없습니다.",
    loading: "NDH 불러오는 중…",
  },
  vi: {
    brand: "Cửa hàng",
    title: "NDH",
    subtitle: "Hàng cận date, bán là xong. Đăng nhập để đặt trên trang order.",
    signIn: "Đăng nhập để đặt",
    openOrder: "Mở NDH trên trang đặt hàng",
    empty: "Chưa có hàng NDH.",
    loading: "Đang tải NDH…",
  },
} as const;

const langLabels: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "VI",
};

function noopAdjust(_sku: string, _delta: number) {}
function noopQty(_sku: string, _value: string) {}

export default function NdhPublicPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [items, setItems] = useState<NdhItem[]>([]);
  const [loading, setLoading] = useState(true);
  const t = copy[lang];
  const ot = orderCopy[lang];

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
    <div className="new-page ndh-public-page">
      <header className="new-header">
        <div className="new-header-top">
          <div className="new-brand">
            <div className="new-logo">NDH</div>
            <span className="new-brand-text">{t.brand}</span>
          </div>
          <div className="new-lang-row" role="group" aria-label="Language">
            {(["en", "zh", "ko", "vi"] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={`new-lang-btn${lang === code ? " is-active" : ""}`}
                onClick={() => changeLang(code)}
              >
                {langLabels[code]}
              </button>
            ))}
          </div>
        </div>
        <h1 className="new-title">{t.title}</h1>
        <p className="new-subtitle">{t.subtitle}</p>
      </header>

      <main className="new-main">
        {loading ? (
          <p className="new-empty">{t.loading}</p>
        ) : items.length === 0 ? (
          <p className="new-empty">{t.empty}</p>
        ) : (
          <div className="order-promo-grid">
            {items.map((item) => {
              const sku = item.sku?.toUpperCase() || "";
              const soldOut = item.remainingQty === 0;
              const priceLabel = item.clearancePrice ? `${ot.ndhPrice}: ${item.clearancePrice}` : undefined;
              const detailsLabel = soldOut ? ot.clearanceSoldOut : formatClearanceDetails(item, ot);
              const remainingLabel = soldOut
                ? ot.clearanceSoldOut
                : item.remainingQty !== null && item.remainingQty !== undefined
                  ? `${ot.clearanceRemaining}: ${item.remainingQty}`
                  : undefined;
              return (
                <CatalogQtyCard
                  key={`${sku}-${item.expiryDate || ""}`}
                  item={item}
                  qty=""
                  palletLabel={ot.pallet}
                  justAddedLabel={ot.justAdded}
                  promoNote={soldOut ? ot.clearanceSoldOut : item.clearanceNote || ot.ndhMode}
                  promoPrice={priceLabel}
                  promoDetails={detailsLabel}
                  promoRemaining={remainingLabel}
                  policyNote={soldOut ? undefined : ot.clearanceNoReturn}
                  inCartLabel={ot.inCart}
                  promoBadgeLabel={ot.ndhMode}
                  editLabel={ot.editProduct}
                  highlight
                  disabled={soldOut}
                  hideInventoryStatus
                  hideQtyControls
                  lang={lang}
                  onAdjust={noopAdjust}
                  onUpdateQty={noopQty}
                />
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
