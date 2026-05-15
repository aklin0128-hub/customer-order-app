"use client";

import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();

  const cards = [
    {
      title: "Customers",
      description: "Create and edit customer login accounts.",
      path: "/admin/customers",
      emoji: "👥",
    },
    {
      title: "Products",
      description: "Manage SKU status, category, limited qty, pallet size, and images.",
      path: "/admin/products",
      emoji: "📦",
    },
    {
      title: "Orders",
      description: "View submitted order history and download CSV files.",
      path: "/admin/orders",
      emoji: "🧾",
    },
  ];

  return (
    <main style={mainStyle}>
      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Rhee Bros Ordering System</div>
          <h1 style={titleStyle}>Admin Dashboard</h1>
          <p style={subtitleStyle}>Choose what you want to manage.</p>
        </div>
      </section>

      <section style={gridStyle}>
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => router.push(card.path)}
            style={cardStyle}
          >
            <div style={emojiStyle}>{card.emoji}</div>
            <div style={cardTitleStyle}>{card.title}</div>
            <div style={cardDescriptionStyle}>{card.description}</div>
            <div style={openStyle}>Open →</div>
          </button>
        ))}
      </section>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "24px 14px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const headerStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto 16px",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#2563eb",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 30,
  fontWeight: 900,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 14,
  color: "#6b7280",
};

const gridStyle: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: 22,
  padding: 20,
  textAlign: "left",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const emojiStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 16,
  background: "#eff6ff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  marginBottom: 14,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#111827",
};

const cardDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.45,
  marginTop: 6,
  minHeight: 38,
};

const openStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#2563eb",
  marginTop: 14,
};
