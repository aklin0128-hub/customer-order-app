import type { CSSProperties } from "react";

const boxStyle: CSSProperties = {
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  fontSize: 13,
  lineHeight: 1.45,
  color: "#1e40af",
};

const promoBoxStyle: CSSProperties = {
  ...boxStyle,
  background: "#f0fdfa",
  border: "1px solid #99f6e4",
  color: "#115e59",
};

const linkStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 800,
  textDecoration: "none",
};

const promoLinkStyle: CSSProperties = {
  ...linkStyle,
  color: "#0f766e",
};

const copy = {
  promotions: {
    title: "Public page: /promo/",
    body: "Promotions with status Active appear on /promo/, the /new/ Promotions tab, and the customer order Promotions tab. Data is shared — no separate publish step. Refresh /promo/ after you save.",
    href: "/promo/",
    openLabel: "Open /promo/ preview ↗",
  },
  products: {
    title: "Public page: /new/ (New items)",
    body: 'Check "Show in New items" below (saved to Redis), or name/size containing the word NEW. Those SKUs appear on /new/ and in the customer catalog new filter — same rules as the order page.',
    href: "/new/",
    openLabel: "Open /new/ preview ↗",
  },
} as const;

export function AdminPublicShowcaseHint({ variant }: { variant: keyof typeof copy }) {
  const t = copy[variant];
  const isPromo = variant === "promotions";

  return (
    <div style={isPromo ? promoBoxStyle : boxStyle} role="note">
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{t.title}</div>
      <p style={{ margin: "0 0 8px" }}>{t.body}</p>
      <a href={t.href} target="_blank" rel="noopener noreferrer" style={isPromo ? promoLinkStyle : linkStyle}>
        {t.openLabel}
      </a>
    </div>
  );
}
