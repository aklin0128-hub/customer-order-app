import type { CSSProperties } from "react";

export const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "14px 10px 120px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  overflow: "visible",
};
export const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflow: "visible",
};
export const cardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  padding: 14,
  border: "1px solid #e5e7eb",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  overflow: "visible",
};
export const sectionTitleStyle: CSSProperties = { fontSize: 17, fontWeight: 800, color: "#111827" };
export const sectionToggleStyle: CSSProperties = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};
export const toggleTextStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: "#2563eb" };
export const smallButtonStyle: CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: 10,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};
export const dangerSmallButtonStyle: CSSProperties = {
  border: "1px solid #fecaca",
  background: "#ffffff",
  color: "#dc2626",
  borderRadius: 10,
  padding: "7px 9px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};
export const langButtonStyle = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
  background: active ? "#eff6ff" : "#ffffff",
  color: active ? "#2563eb" : "#374151",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
});
export const modeTabsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};
export const modeButtonStyle = (active: boolean): CSSProperties => ({
  padding: "10px 6px",
  borderRadius: 12,
  border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
  background: active ? "#eff6ff" : "#ffffff",
  color: active ? "#1d4ed8" : "#374151",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1.25,
});
export const promoModeButtonStyle = (active: boolean): CSSProperties => ({
  ...modeButtonStyle(active),
  border: active ? "1px solid #0f766e" : "1px solid #5eead4",
  background: active ? "#ccfbf1" : "#f0fdfa",
  color: active ? "#0f766e" : "#115e59",
});
export const clearanceModeButtonStyle = (active: boolean): CSSProperties => ({
  ...modeButtonStyle(active),
  border: active ? "1px solid #ea580c" : "1px solid #fdba74",
  background: active ? "#ffedd5" : "#fff7ed",
  color: active ? "#c2410c" : "#9a3412",
  fontSize: 11,
});
export const newItemsModeButtonStyle = (active: boolean): CSSProperties => ({
  ...modeButtonStyle(active),
  border: active ? "1px solid #ea580c" : "1px solid #fdba74",
  background: active ? "#ea580c" : "#fff7ed",
  color: active ? "#ffffff" : "#c2410c",
  fontSize: 11,
});
export const qtyButtonStyle: CSSProperties = {
  padding: "6px 0",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
export const primarySmallButtonStyle: CSSProperties = {
  width: "35%",
  minWidth: 110,
  maxWidth: 150,
  padding: "8px 0",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
export const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  padding: "11px 16px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
export const dangerButtonStyle: CSSProperties = {
  width: "100%",
  padding: "11px 16px",
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
export const submitButtonStyle: CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 12,
  border: "none",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};
export const emptyStyle: CSSProperties = {
  padding: "14px 12px",
  borderRadius: 12,
  background: "#f9fafb",
  color: "#6b7280",
  fontSize: 14,
  textAlign: "center",
};
export const cartListScrollStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: "min(48vh, 400px)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  marginTop: 10,
  paddingRight: 4,
  background: "#ffffff",
};
export const cartItemStyle: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 10,
  background: "#f9fafb",
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  overflow: "visible",
};
export const cartQtyInputStyle: CSSProperties = {
  width: 92,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 13,
  fontWeight: 700,
  background: "#ffffff",
  outline: "none",
};
export const productSmallButtonStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: 12,
  padding: 10,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  gap: 10,
  alignItems: "center",
  overflow: "visible",
  position: "relative",
};
export const wideInputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  boxSizing: "border-box",
  outline: "none",
  background: "#ffffff",
};
export const promoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 8,
};
export const catalogCardStyle: CSSProperties = {
  borderRadius: 12,
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  overflow: "visible",
  position: "relative",
  minWidth: 0,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};
export const catalogNameStyle: CSSProperties = {
  fontSize: 12,
  color: "#4b5563",
  lineHeight: 1.3,
  maxHeight: 40,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
};
export const promoTagStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  background: "#ccfbf1",
  color: "#0f766e",
  border: "1px solid #5eead4",
};
export const promoPriceStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0f766e",
};
export const promoDealStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#b45309",
  background: "#fffbeb",
  border: "1px solid #fcd34d",
  borderRadius: 8,
  padding: "5px 8px",
  lineHeight: 1.3,
  textAlign: "center",
};
export const promoDetailsStyle: CSSProperties = {
  fontSize: 10,
  color: "#6b7280",
  lineHeight: 1.35,
};
export const clearancePolicyStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#c2410c",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  borderRadius: 8,
  padding: "4px 8px",
  lineHeight: 1.35,
  alignSelf: "flex-start",
};
export const inCartTagStyle: CSSProperties = {
  fontSize: 11,
  color: "#059669",
  fontWeight: 900,
};
export const catalogStepperStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "38px 1fr 38px",
  gap: 6,
  alignItems: "center",
  marginTop: 4,
  paddingTop: 0,
};
export const catalogStepBtnStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  fontSize: 22,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
};
export const catalogStepInputStyle: CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  textAlign: "center",
  fontSize: 15,
  fontWeight: 900,
  outline: "none",
  boxSizing: "border-box",
};
export const stepperStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "30px 1fr 30px",
  gap: 5,
  alignItems: "center",
};
export const stepButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#f9fafb",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
  lineHeight: 1,
};
export const stepInputStyle: CSSProperties = {
  width: "100%",
  height: 32,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 900,
  outline: "none",
  boxSizing: "border-box",
};
export const limitedBadgeStyle: CSSProperties = {
  padding: "2px 7px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 800,
  background: "#fff7ed",
  color: "#c2410c",
  border: "1px solid #fed7aa",
};
export const filterBlockStyle: CSSProperties = { marginBottom: 10 };
export const filterLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#6b7280",
  marginBottom: 6,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};
export const categoryBarStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 4,
  WebkitOverflowScrolling: "touch",
  flexWrap: "nowrap",
  alignItems: "center",
};
export const categoryButtonStyle = (active: boolean): CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 999,
  border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
  background: active ? "#eff6ff" : "#ffffff",
  color: active ? "#2563eb" : "#374151",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export { justAddedBadgeStyle as justAddedTagStyle } from "@/lib/justAddedBadge";

export const brandSelectStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  maxWidth: 200,
  minWidth: 120,
  flexShrink: 0,
};
export const fixedSubmitBarStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 14,
  transform: "translateX(-50%)",
  width: "calc(100% - 24px)",
  maxWidth: 980,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #d1d5db",
  borderRadius: 16,
  padding: 10,
  boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
  zIndex: 8000,
};
export const reviewOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17,24,39,0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 14,
  zIndex: 9000,
};
export const reviewModalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 760,
  maxHeight: "min(90vh, 900px)",
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  padding: 16,
  boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};
export const reviewModalBodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingRight: 4,
  WebkitOverflowScrolling: "touch",
};

export const reviewModalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
  flexShrink: 0,
};
export const reviewListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};
export const reviewModalFooterStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid #eef2f7",
  flexShrink: 0,
};
export const stickyCatalogToolsStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 50,
  background: "rgba(255,255,255,0.97)",
  padding: "6px 0 8px",
  marginBottom: 8,
  borderBottom: "1px solid #eef2f7",
};

export const compactCatalogToolsRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
};

export const cartSummaryTextStyle: CSSProperties = {
  textAlign: "center",
  fontSize: 13,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 8,
};

/** Shared qty strip (− · input · + · …) for cart + review modal */
export const reviewQtyControlStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(48px, 1fr) 34px auto",
  gap: 6,
  alignItems: "center",
  minWidth: 0,
};
export const compactQtyStripWrapStyle: CSSProperties = {
  flex: "1 1 min(290px, 100%)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  minWidth: 0,
};

export const reviewQtyButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
};

export const reviewQtyInputStyle: CSSProperties = {
  width: "100%",
  minWidth: 48,
  height: 34,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  textAlign: "center",
  fontSize: 14,
  fontWeight: 900,
  outline: "none",
  boxSizing: "border-box",
};

export const reviewRemoveButtonStyle: CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#dc2626",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  padding: "0 9px",
};

export const reviewItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#f9fafb",
  padding: 10,
  flexWrap: "wrap",
};
export const cartQtyStripWrapStyle: CSSProperties = {
  flex: "1 1 100%",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
};

/** Read-only submitted order lines (avoid flex:1 bleed in short modals) */
export const submittedOrderListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  overflowY: "auto",
  paddingRight: 4,
  marginTop: 12,
  maxHeight: "min(42vh, 340px)",
};

/** Scroll area for virtualized catalog grid */
export const catalogVirtualScrollStyle: CSSProperties = {
  width: "100%",
  height: "min(70vh, 900px)",
  overflow: "auto",
  marginTop: 4,
  WebkitOverflowScrolling: "touch",
  boxSizing: "border-box",
};
