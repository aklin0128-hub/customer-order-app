#!/usr/bin/env node
/**
 * Local Upstash REST stand-in for Cloud Agent development.
 * Speaks the subset of the Upstash Redis HTTP API this app uses
 * (GET/SET/DEL/MGET/KEYS/SADD/SREM/SMEMBERS), including /pipeline.
 * Data is stored in a JSON file under /tmp and is not production data.
 */
import http from "node:http";
import fs from "node:fs";

const PORT = Number(process.env.DEV_UPSTASH_PORT || 8079);
const HOST = process.env.DEV_UPSTASH_HOST || "127.0.0.1";
const TOKEN = process.env.DEV_UPSTASH_TOKEN || "local-dev";
const DATA_FILE = process.env.DEV_UPSTASH_DATA || "/tmp/customer-order-dev-redis.json";

/** @type {Map<string, string>} */
const strings = new Map();
/** @type {Map<string, Set<string>>} */
const sets = new Map();

function load() {
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [key, value] of Object.entries(raw.strings || {})) {
      strings.set(key, String(value));
    }
    for (const [key, members] of Object.entries(raw.sets || {})) {
      sets.set(key, new Set((members || []).map(String)));
    }
  } catch (error) {
    console.warn("Ignoring unreadable dev redis file:", error?.message || error);
  }
}

function save() {
  const payload = {
    strings: Object.fromEntries(strings),
    sets: Object.fromEntries([...sets].map(([key, members]) => [key, [...members]])),
  };
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, DATA_FILE);
}

function globToRegExp(pattern) {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") out += ".*";
    else if (ch === "?") out += ".";
    else if ("\\^$+()|{}[].".includes(ch)) out += `\\${ch}`;
    else out += ch;
  }
  return new RegExp(`${out}$`);
}

function encode(value, useB64) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.map((item) => encode(item, useB64));
  const text = String(value);
  if (!useB64 || text === "OK") return text;
  return Buffer.from(text, "utf8").toString("base64");
}

function execCommand(args) {
  const [rawName, ...rest] = args;
  const name = String(rawName || "").toUpperCase();
  const key = rest.length ? String(rest[0]) : "";

  if (name === "GET") {
    if (sets.has(key)) return { error: "WRONGTYPE Operation against a key holding the wrong kind of value" };
    return { result: strings.has(key) ? strings.get(key) : null };
  }

  if (name === "SET") {
    sets.delete(key);
    strings.set(key, rest.length > 1 ? String(rest[1]) : "");
    save();
    return { result: "OK" };
  }

  if (name === "DEL") {
    let removed = 0;
    for (const item of rest) {
      const itemKey = String(item);
      if (strings.delete(itemKey)) removed += 1;
      if (sets.delete(itemKey)) removed += 1;
    }
    if (removed) save();
    return { result: removed };
  }

  if (name === "MGET") {
    const values = rest.map((item) => {
      const itemKey = String(item);
      if (sets.has(itemKey)) return null;
      return strings.has(itemKey) ? strings.get(itemKey) : null;
    });
    return { result: values };
  }

  if (name === "KEYS") {
    const pattern = key || "*";
    const re = globToRegExp(pattern);
    const keys = [...new Set([...strings.keys(), ...sets.keys()])].filter((item) => re.test(item)).sort();
    return { result: keys };
  }

  if (name === "SADD") {
    if (strings.has(key)) return { error: "WRONGTYPE Operation against a key holding the wrong kind of value" };
    if (!sets.has(key)) sets.set(key, new Set());
    const bucket = sets.get(key);
    let added = 0;
    for (const member of rest.slice(1)) {
      const value = String(member);
      if (!bucket.has(value)) {
        bucket.add(value);
        added += 1;
      }
    }
    if (added) save();
    return { result: added };
  }

  if (name === "SREM") {
    const bucket = sets.get(key);
    if (!bucket) return { result: 0 };
    let removed = 0;
    for (const member of rest.slice(1)) {
      if (bucket.delete(String(member))) removed += 1;
    }
    if (bucket.size === 0) sets.delete(key);
    if (removed) save();
    return { result: removed };
  }

  if (name === "SMEMBERS") {
    if (strings.has(key)) return { error: "WRONGTYPE Operation against a key holding the wrong kind of value" };
    return { result: [...(sets.get(key) || [])] };
  }

  if (name === "PING") return { result: "PONG" };

  return { error: `ERR unknown command '${name}'` };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authorized(req) {
  const header = String(req.headers.authorization || "");
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token === TOKEN;
}

load();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (!authorized(req)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "UNAUTHORIZED" }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body;
  try {
    body = JSON.parse((await readBody(req)) || "null");
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const useB64 = String(req.headers["upstash-encoding"] || "").toLowerCase() === "base64";
  const path = url.pathname.replace(/\/$/, "") || "/";
  const isBatch = path === "/pipeline" || path === "/multi-exec" || (Array.isArray(body) && Array.isArray(body[0]));
  const commands = isBatch ? body : [body];

  if (!Array.isArray(commands) || commands.some((command) => !Array.isArray(command))) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Expected a Redis command array" }));
    return;
  }

  const results = commands.map((command) => {
    const outcome = execCommand(command);
    if (outcome.error) return { error: outcome.error, result: null };
    return { result: encode(outcome.result, useB64) };
  });

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(isBatch ? results : results[0]));
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.log(`dev upstash already listening on ${HOST}:${PORT}`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`dev upstash listening on http://${HOST}:${PORT}`);
});
