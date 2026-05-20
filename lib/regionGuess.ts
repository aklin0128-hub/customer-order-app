import { type MarketRegionId } from "@/lib/customerRegion";

const RULES: { region: MarketRegionId; patterns: RegExp[] }[] = [
  {
    region: "miami",
    patterns: [/\bMIAMI\b/i, /\bHIALEAH\b/i, /\bDORAL\b/i, /\bKENDALL\b/i, /\bHOMESTEAD\b/i],
  },
  {
    region: "orlando",
    patterns: [/\bORLANDO\b/i, /\bKISSIMMEE\b/i, /\bSANFORD\b/i, /\bWINTER\s*PARK\b/i],
  },
  {
    region: "melbourne",
    patterns: [/\bMELBOURNE\b/i, /\bPALM\s*BAY\b/i, /\bCOCOA\b/i, /\bTITUSVILLE\b/i],
  },
  {
    region: "jacksonville",
    patterns: [/\bJACKSONVILLE\b/i, /\bJAX\b/i, /\bST\.?\s*AUGUSTINE\b/i, /\bORANGE\s*PARK\b/i],
  },
];

export function guessRegionFromText(text: string): MarketRegionId | null {
  const hay = String(text || "").trim();
  if (!hay) return null;
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.region;
  }
  return null;
}
