"use client";

import { useEffect, useState } from "react";

import { formatMoneyPrice } from "@/lib/promoFormat";
import type { LoginPreviewCard } from "@/lib/loginPreview";

type Lang = "en" | "zh" | "ko" | "vi";
type PreviewTab = "promo" | "new";

const copy = {
  en: {
    previewTitle: "Browse before you sign in",
    tabPromo: "Weekly picks",
    tabNew: "New items",
    loginToOrder: "Sign in to add items to your cart and place your order.",
    loading: "Loading…",
    emptyPromo: "No weekly picks right now.",
    emptyNew: "No new items right now.",
    promoPrice: "Promo",
    previewOnly: "Preview only",
  },
  zh: {
    previewTitle: "登录前先看本周推荐",
    tabPromo: "本周主推",
    tabNew: "新品",
    loginToOrder: "登录后即可加入购物车并提交订单。",
    loading: "加载中…",
    emptyPromo: "暂无本周主推。",
    emptyNew: "暂无新品。",
    promoPrice: "特价",
    previewOnly: "仅预览",
  },
  ko: {
    previewTitle: "로그인 전에 둘러보기",
    tabPromo: "이번 주 추천",
    tabNew: "신상품",
    loginToOrder: "로그인 후 장바구니에 담고 주문할 수 있습니다.",
    loading: "불러오는 중…",
    emptyPromo: "이번 주 추천이 없습니다.",
    emptyNew: "신상품이 없습니다.",
    promoPrice: "행사가",
    previewOnly: "미리보기",
  },
  vi: {
    previewTitle: "Xem trước khi đăng nhập",
    tabPromo: "Nổi bật tuần",
    tabNew: "Hàng mới",
    loginToOrder: "Đăng nhập để thêm vào giỏ và đặt hàng.",
    loading: "Đang tải…",
    emptyPromo: "Chưa có nổi bật tuần.",
    emptyNew: "Chưa có hàng mới.",
    promoPrice: "Khuyến mãi",
    previewOnly: "Chỉ xem",
  },
};

function PreviewCard({ item, lang, showPromo }: { item: LoginPreviewCard; lang: Lang; showPromo: boolean }) {
  const t = copy[lang];
  const [imgError, setImgError] = useState(false);

  return (
    <article className="login-preview-card">
      <div className="login-preview-card-img-wrap">
        {imgError ? (
          <div className="login-preview-card-img-fallback">SKU</div>
        ) : (
          <img
            src={item.imageUrl || `/product/${item.sku}.jpg`}
            alt={item.name || item.sku}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <div className="login-preview-card-sku">{item.sku}</div>
      {item.brand ? <div className="login-preview-card-brand">{item.brand}</div> : null}
      <div className="login-preview-card-name">{item.name || "—"}</div>
      {item.size ? <div className="login-preview-card-size">{item.size}</div> : null}
      {showPromo && item.promoPrice ? (
        <div className="login-preview-card-price">
          {t.promoPrice}: {formatMoneyPrice(item.promoPrice)}
        </div>
      ) : null}
      <div className="login-preview-card-badge">{t.previewOnly}</div>
    </article>
  );
}

export function LoginPreviewSection({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [tab, setTab] = useState<PreviewTab>("promo");
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<LoginPreviewCard[]>([]);
  const [newItems, setNewItems] = useState<LoginPreviewCard[]>([]);
  const [promotionTotal, setPromotionTotal] = useState(0);
  const [newItemTotal, setNewItemTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/login-preview", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error("load failed");
        if (cancelled) return;
        setPromotions(Array.isArray(data.promotions) ? data.promotions : []);
        setNewItems(Array.isArray(data.newItems) ? data.newItems : []);
        setPromotionTotal(Number(data.promotionTotal) || 0);
        setNewItemTotal(Number(data.newItemTotal) || 0);
        if ((data.promotions?.length || 0) === 0 && (data.newItems?.length || 0) > 0) {
          setTab("new");
        }
      } catch {
        if (!cancelled) {
          setPromotions([]);
          setNewItems([]);
          setPromotionTotal(0);
          setNewItemTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = tab === "promo" ? promotions : newItems;
  const total = tab === "promo" ? promotionTotal : newItemTotal;
  const emptyText = tab === "promo" ? t.emptyPromo : t.emptyNew;

  if (!loading && promotionTotal === 0 && newItemTotal === 0) {
    return null;
  }

  return (
    <section className="login-preview" aria-label={t.previewTitle}>
      <div className="login-preview-head">
        <h2 className="login-preview-title">{t.previewTitle}</h2>
        <p className="login-preview-hint">{t.loginToOrder}</p>
      </div>

      <div className="login-preview-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "promo"}
          className={`login-preview-tab is-promo${tab === "promo" ? " is-active" : ""}`}
          onClick={() => setTab("promo")}
        >
          {t.tabPromo}
          {promotionTotal > 0 ? ` (${promotionTotal})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "new"}
          className={`login-preview-tab is-new${tab === "new" ? " is-active" : ""}`}
          onClick={() => setTab("new")}
        >
          {t.tabNew}
          {newItemTotal > 0 ? ` (${newItemTotal})` : ""}
        </button>
      </div>

      {loading ? (
        <div className="login-preview-loading">{t.loading}</div>
      ) : items.length === 0 ? (
        <div className="login-preview-empty">{emptyText}</div>
      ) : (
        <div className="login-preview-strip" role="list">
          {items.map((item) => (
            <PreviewCard key={item.sku} item={item} lang={lang} showPromo={tab === "promo"} />
          ))}
        </div>
      )}
    </section>
  );
}
