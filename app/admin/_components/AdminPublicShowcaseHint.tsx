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

const linkStyle: CSSProperties = {
  color: "#1d4ed8",
  fontWeight: 800,
  textDecoration: "none",
};

const copy = {
  promotions: {
    title: "Public page: /new/ (Weekly picks)",
    body: "Promotions with status Active appear on the public showcase and in the customer order Weekly picks tab. Data is shared — no separate publish step. Refresh /new/ after you save.",
  },
  products: {
    title: "Public page: /new/ (New items)",
    body: 'Check "Show in New items" below (saved to Redis), or name/size containing the word NEW. Those SKUs appear on /new/ and in the customer catalog new filter — same rules as the order page.',
  },
} as const;

export function AdminPublicShowcaseHint({ variant }: { variant: keyof typeof copy }) {
  const t = copy[variant];

  return (
    <div style={boxStyle} role="note">
      <div style={{ fontWeight: 900, marginBottom: 4 }}>{t.title}</div>
      <p style={{ margin: "0 0 8px" }}>{t.body}</p>
      <a href="/new/" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Open /new/ preview ↗
      </a>
    </div>
  );
}
