export const WEEKDAY_OPTIONS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export function parseUsDateToIso(us: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(us || "").trim());
  if (!m) return "";
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export function weekdayFromDateInput(iso: string) {
  if (!iso) return "Mon";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Mon";
  const label = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "America/New_York",
  }).format(d);
  return WEEKDAY_OPTIONS.includes(label as (typeof WEEKDAY_OPTIONS)[number]) ? label : "Mon";
}
