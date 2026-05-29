"use client";

import { useEffect } from "react";

import type { LoginPreviewCard } from "@/lib/loginPreview";
import type { Lang } from "@/lib/showcasePromoFormat";

const copy: Record<
  Lang,
  { close: string; openPdf: string; title: string }
> = {
  en: { close: "Close", openPdf: "Open PDF in new tab", title: "Product details" },
  zh: { close: "关闭", openPdf: "在新标签页打开 PDF", title: "产品说明" },
  ko: { close: "닫기", openPdf: "새 탭에서 PDF 열기", title: "상품 설명" },
  vi: { close: "Đóng", openPdf: "Mở PDF trong tab mới", title: "Chi tiết sản phẩm" },
};

export function ShowcaseDescriptionModal({
  item,
  lang,
  onClose,
}: {
  item: LoginPreviewCard;
  lang: Lang;
  onClose: () => void;
}) {
  const t = copy[lang];
  const text = String(item.newItemDescription || "").trim();
  const pdfUrl = String(item.newItemDescriptionPdfUrl || "").trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="showcase-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="showcase-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="showcase-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="showcase-modal-header">
          <div>
            <h2 id="showcase-modal-title" className="showcase-modal-title">
              {t.title}
            </h2>
            <div className="showcase-modal-sku">{item.sku}</div>
            {item.name ? <div className="showcase-modal-name">{item.name}</div> : null}
          </div>
          <button type="button" className="showcase-modal-close" onClick={onClose} aria-label={t.close}>
            ×
          </button>
        </div>

        {text ? <div className="showcase-modal-text">{text}</div> : null}

        {pdfUrl ? (
          <div className="showcase-modal-pdf">
            <iframe title={`${item.sku} PDF`} src={pdfUrl} className="showcase-modal-pdf-frame" />
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="showcase-modal-pdf-link">
              {t.openPdf}
            </a>
          </div>
        ) : null}

        <button type="button" className="showcase-modal-done" onClick={onClose}>
          {t.close}
        </button>
      </div>
    </div>
  );
}
