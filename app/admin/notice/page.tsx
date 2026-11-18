"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ORDER_NOTICE_LANGS,
  emptyTranslations,
  hasNoticeBody,
  isOrderNoticeExpired,
  type OrderNoticeLang,
  type OrderNoticeRecord,
  type OrderNoticeTranslations,
} from "@/lib/orderNotice";
import { AdminPage } from "../_components/AdminPage";
import { FieldLabel } from "../_components/admin-sales-ui";
import { inputStyle } from "../_components/admin-styles";
import { BtnDanger, BtnPrimary, BtnRow, BtnSecondary, Panel, Toast } from "../_components/admin-utils";
import { useAdminAuth } from "../_components/useAdminAuth";

const LANG_LABEL: Record<OrderNoticeLang, string> = {
  en: "English",
  zh: "中文",
  ko: "한국어",
  vi: "Tiếng Việt",
};

const PLACEHOLDER: Record<OrderNoticeLang, { title: string; body: string }> = {
  en: { title: "Honeydew", body: "Honeydew is out of stock. Expected back around 12/1." },
  zh: { title: "蜜瓜", body: "蜜瓜暂时没货，预计 12/1 左右到货。" },
  ko: { title: "허니듀", body: "허니듀가 품절입니다. 12/1경 입고 예정입니다." },
  vi: { title: "Dưa honeydew", body: "Dưa honeydew hết hàng. Dự kiến có lại khoảng 12/1." },
};

export default function AdminNoticePage() {
  const { authed, adminHeaders } = useAdminAuth();
  const [translations, setTranslations] = useState<OrderNoticeTranslations>(emptyTranslations);
  const [hideOnDate, setHideOnDate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saved, setSaved] = useState<OrderNoticeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone?: "success" | "error" } | null>(null);

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/order-notice", { headers: adminHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to load notice.");
    const record = data.record as OrderNoticeRecord;
    setTranslations(record?.translations || emptyTranslations());
    setHideOnDate(record?.hideOnDate || "");
    setEnabled(Boolean(record?.enabled && hasNoticeBody(record.translations)));
    setSaved(record || null);
  }, [adminHeaders]);

  useEffect(() => {
    if (!authed) return;
    void load().catch((err: unknown) => {
      notify(err instanceof Error ? err.message : "Failed to load.", "error");
    });
  }, [authed, load]);

  function patchLang(lang: OrderNoticeLang, field: "title" | "body", value: string) {
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }));
  }

  async function save(nextEnabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/order-notice", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ translations, hideOnDate, enabled: nextEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      const record = data.record as OrderNoticeRecord;
      setSaved(record);
      setTranslations(record.translations);
      setHideOnDate(record.hideOnDate || "");
      setEnabled(record.enabled);
      const expired = isOrderNoticeExpired(record.hideOnDate);
      if (!record.enabled) notify("Notice saved and hidden from customers.");
      else if (expired) notify("Notice saved. It is past the hide date, so customers will not see it.");
      else notify("Notice is live on the order page.");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  const expired = isOrderNoticeExpired(hideOnDate);
  const canSave = hasNoticeBody(translations);

  return (
    <AdminPage
      active="notice"
      title="Order notice"
      subtitle="Popup customers see when they open the order page. Close with × or after 20 seconds. Write each language separately."
      loginTitle="Order notice"
      loginSubtitle="Sign in to publish an order-page announcement."
    >
      <Panel title="Announcement">
        {ORDER_NOTICE_LANGS.map((lang) => (
          <div key={lang} style={{ marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
            <FieldLabel>{LANG_LABEL[lang]}</FieldLabel>
            <input
              value={translations[lang].title}
              onChange={(e) => patchLang(lang, "title", e.target.value)}
              placeholder={`${PLACEHOLDER[lang].title} (optional title)`}
              style={{ ...inputStyle, marginBottom: 8 }}
              maxLength={120}
            />
            <textarea
              value={translations[lang].body}
              onChange={(e) => patchLang(lang, "body", e.target.value)}
              placeholder={PLACEHOLDER[lang].body}
              rows={4}
              maxLength={4000}
              style={{ ...inputStyle, minHeight: 96, resize: "vertical" }}
            />
          </div>
        ))}

        <FieldLabel>Hide on date (US Eastern)</FieldLabel>
        <input
          type="date"
          value={hideOnDate}
          onChange={(e) => setHideOnDate(e.target.value)}
          style={{ ...inputStyle, maxWidth: 220, marginBottom: 8 }}
        />
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
          Starting this date the popup is hidden automatically. Leave blank to keep showing until you hide it.
        </p>
        {expired && hideOnDate ? (
          <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 800, color: "#b45309" }}>
            This hide date has already been reached, so customers will not see the popup.
          </p>
        ) : null}

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Show on order page
        </label>
        <BtnRow>
          <BtnPrimary disabled={busy || !canSave} onClick={() => void save(enabled)}>
            {busy ? "Saving…" : "Save notice"}
          </BtnPrimary>
          <BtnSecondary
            disabled={busy}
            onClick={() =>
              void load().catch((err: unknown) => {
                notify(err instanceof Error ? err.message : "Failed to load.", "error");
              })
            }
          >
            Reload
          </BtnSecondary>
          <BtnDanger disabled={busy} onClick={() => void save(false)}>
            Hide from customers
          </BtnDanger>
        </BtnRow>
        {saved?.updatedAt ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6b7280" }}>
            Last saved {new Date(saved.updatedAt).toLocaleString()}
            {saved.enabled ? (isOrderNoticeExpired(saved.hideOnDate) ? " · expired / hidden" : " · live") : " · hidden"}
          </p>
        ) : null}
      </Panel>
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    </AdminPage>
  );
}
