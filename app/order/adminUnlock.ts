export const ADMIN_UNLOCK_TAP_COUNT = 5;
export const ADMIN_UNLOCK_TAP_WINDOW_MS = 1800;

export function isAdminUnlockSearch(search: string) {
  const raw = String(search || "").trim();
  const q = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const value = (q.get("admin") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
