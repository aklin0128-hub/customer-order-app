import type { CSSProperties } from "react";

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const loginPage: CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  fontFamily: font,
};

export const loginCard: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 16px 40px rgba(37,99,235,0.12)",
};

export const logo: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 14,
  background: "#2563eb",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  fontWeight: 900,
  marginBottom: 14,
};

export const loginTitle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 900,
  color: "#111827",
};

export const loginSubtitle: CSSProperties = {
  margin: "6px 0 16px",
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.45,
};

export const backLink: CSSProperties = {
  display: "block",
  marginTop: 14,
  textAlign: "center",
  fontSize: 13,
  color: "#6b7280",
  textDecoration: "none",
};

export const shell: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  fontFamily: font,
  background: "#f1f5f9",
};

export const sidebar: CSSProperties = {
  width: 236,
  flexShrink: 0,
  background: "#0f172a",
  color: "#e2e8f0",
  padding: "16px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  position: "sticky",
  top: 0,
  height: "100vh",
};

export const brandTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#f8fafc",
  marginTop: -4,
};

export const brandSub: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  marginBottom: 8,
};

export const nav: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
};

export const navLink: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  padding: "10px 12px",
  borderRadius: 12,
  textDecoration: "none",
  color: "#cbd5e1",
  border: "1px solid transparent",
};

export const navLinkActive: CSSProperties = {
  background: "#1e293b",
  borderColor: "#334155",
  color: "#fff",
};

export const navLabel: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
};

export const navHint: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
};

export const logoutBtn: CSSProperties = {
  border: "1px solid #334155",
  background: "transparent",
  color: "#e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

export const mainArea: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

export const topBar: CSSProperties = {
  background: "#fff",
  borderBottom: "1px solid #e5e7eb",
  padding: "16px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

export const pageTitle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
};

export const pageSubtitle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 13,
  color: "#6b7280",
};

export const topActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

export const content: CSSProperties = {
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  maxWidth: 1400,
  width: "100%",
};

export const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
};

export const btnPrimary: CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

export const btnSecondary: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

export const btnDanger: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

export const btnRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
};

export const alertError: CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 700,
};

export const alertSuccess: CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#ecfdf5",
  border: "1px solid #a7f3d0",
  color: "#15803d",
  fontSize: 13,
  fontWeight: 700,
};

export const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

export const statCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
};

export const statValue: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#2563eb",
};

export const statLabel: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  marginTop: 2,
};

export const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
};

export const panelTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 16,
  fontWeight: 900,
  color: "#111827",
};

export const emptyState: CSSProperties = {
  padding: 24,
  textAlign: "center",
  background: "#f9fafb",
  borderRadius: 12,
  border: "1px dashed #d1d5db",
};

export const splitLayout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 1fr) minmax(300px, 1.1fr)",
  gap: 14,
  alignItems: "start",
};

/** Use with className `admin-split-list` — do not add flex on inline style (crushes rows). */
export const splitList: CSSProperties = {};

export const splitForm: CSSProperties = {
  position: "sticky",
  top: 80,
};

export const listItem: CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 12,
  padding: 12,
  textAlign: "left",
  cursor: "pointer",
  outline: "none",
};

export const listItemSelected: CSSProperties = {
  borderColor: "#2563eb",
  background: "#eff6ff",
  boxShadow: "0 0 0 1px #2563eb",
};

export const chipRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 10,
};

export const chip: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

export const chipActive: CSSProperties = {
  borderColor: "#2563eb",
  background: "#eff6ff",
  color: "#2563eb",
};

export const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};
