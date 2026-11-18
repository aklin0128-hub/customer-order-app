/** Keep numeric qty typing from wiping a line when letters are entered. */
export function sanitizeQtyInput(value: string): { qty: string; ignore: boolean } {
  const raw = String(value ?? "");
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits) return { qty: digits, ignore: false };
  if (raw.trim() === "") return { qty: "", ignore: false };
  return { qty: "", ignore: true };
}
