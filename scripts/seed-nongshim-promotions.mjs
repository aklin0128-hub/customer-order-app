/**
 * Merge Nongshim May 2026 promotions into Redis (promotions:list).
 * Usage: node scripts/seed-nongshim-promotions.mjs
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Redis } from "@upstash/redis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PROMOTIONS_KEY = "promotions:list";

function loadEnvFile(fileName) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalizeSku(sku) {
  return String(sku || "")
    .trim()
    .toUpperCase();
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.");
  process.exit(1);
}

const dataPath = path.join(root, "data/promotions-nongshim-2026-05.json");
const incoming = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const redis = new Redis({ url, token });

const campaignSkus = new Set(incoming.map((row) => normalizeSku(row.sku)));
const now = new Date().toISOString();

const campaignRecords = incoming.map((row) => ({
  sku: normalizeSku(row.sku),
  note: row.note || "NONGSHIM PROMO",
  endDate: row.endDate || "2026-05-31",
  promoPrice: row.promoPrice || "",
  soldQty: 0,
  updatedAt: now,
}));

const existing = (await redis.get(PROMOTIONS_KEY)) || [];
const kept = Array.isArray(existing)
  ? existing.filter((row) => row?.sku && !campaignSkus.has(normalizeSku(row.sku)))
  : [];

const next = [...campaignRecords, ...kept];

await redis.set(PROMOTIONS_KEY, next);

console.log(`Nongshim promo: added/updated ${campaignRecords.length} SKUs (ends 2026-05-31).`);
console.log(`Total promotions in Redis: ${next.length} (${kept.length} other items kept).`);
