import type { Lang } from "@/app/order/types";

export function formatCountLabel(n: number, lang: Lang, singular: string, plural: string) {
  const noun = lang === "en" && Math.abs(n) === 1 ? singular : plural;
  return `${n} ${noun}`;
}

export function formatLinesAndCases(
  lang: Lang,
  lines: number,
  cases: number,
  t: { lines: string; cases: string; lineOne?: string; caseOne?: string }
) {
  return `${formatCountLabel(lines, lang, t.lineOne || "line", t.lines)} · ${formatCountLabel(cases, lang, t.caseOne || "case", t.cases)}`;
}
