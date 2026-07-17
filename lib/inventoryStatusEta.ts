import {
  compactHeaderKey,
  normalizeInventorySku,
  parseInventoryDate,
  skuLookupKeys,
} from "@/lib/inventoryExpiry";

export type StatusEtaInbound = {
  portEta: string | null;
  inboundQty: number | null;
};

export type StatusEtaProduct = {
  pid: string;
  description: string;
  status: string;
  availableInv: number | null;
  inbound: StatusEtaInbound[];
};

export type StatusEtaLookupResult = {
  pid: string;
  found: boolean;
  product: StatusEtaProduct | null;
};

type FlatRow = {
  pid: string;
  description: string;
  status: string;
  availableInv: number | null;
  portEta: string | null;
  inboundQty: number | null;
};

function safeString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseSignedNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = safeString(value).replace(/,/g, "");
  if (!text || text === "-" || text === "—") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function resolveColumn(
  headers: string[],
  matchers: Array<(compact: string, raw: string) => boolean>
): number {
  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i] || "";
    const compact = compactHeaderKey(raw);
    if (matchers.some((fn) => fn(compact, raw))) return i;
  }
  return -1;
}

export function findStatusEtaHeaderRowIndex(aoa: unknown[][]): number {
  const limit = Math.min(aoa.length, 40);
  for (let r = 0; r < limit; r++) {
    const row = aoa[r] || [];
    const headers = row.map((c) => safeString(c));
    const pidIdx = resolveColumn(headers, [
      (c) => c === "PID" || c === "SKU" || c === "ITEM" || c === "LOCITEM",
    ]);
    const etaIdx = resolveColumn(headers, [
      (c) => c.includes("PORTETA") || (c.includes("PORT") && c.includes("ETA")) || c === "ETA",
    ]);
    const invIdx = resolveColumn(headers, [
      (c) =>
        c.includes("AVALINV") ||
        c.includes("AVAILINV") ||
        c.includes("AVAILABLEINV") ||
        c === "AVALINV" ||
        (c.includes("AVAL") && c.includes("INV")),
    ]);
    if (pidIdx >= 0 && (etaIdx >= 0 || invIdx >= 0)) return r;
  }
  return 0;
}

function mapHeaders(headers: string[]) {
  return {
    pid: resolveColumn(headers, [
      (c) => c === "PID" || c === "SKU" || c === "ITEM" || c === "LOCITEM" || c === "PRODUCTID",
    ]),
    description: resolveColumn(headers, [
      (c, raw) =>
        c === "DESCRIPTION" ||
        c === "DESC" ||
        c === "ITEMDESC" ||
        c === "LOCITEMDESC" ||
        /^description$/i.test(raw.trim()),
    ]),
    status: resolveColumn(headers, [
      (c) => c === "STATUS" || c === "STAUTS" || c === "STAT" || c.includes("STATUS"),
    ]),
    availableInv: resolveColumn(headers, [
      (c) =>
        c.includes("AVALINV") ||
        c.includes("AVAILINV") ||
        c.includes("AVAILABLEINV") ||
        c.includes("ONHAND") ||
        (c.includes("AVAL") && c.includes("INV")) ||
        (c.includes("AVAIL") && c.includes("INV")),
    ]),
    portEta: resolveColumn(headers, [
      (c) => c.includes("PORTETA") || (c.includes("PORT") && c.includes("ETA")) || c === "ETA",
    ]),
    inboundQty: resolveColumn(headers, [
      (c) =>
        c.includes("INBOUNDQTY") ||
        c.includes("INBOUND") ||
        (c.includes("INBOUND") && c.includes("QTY")) ||
        c === "INBQTY",
    ]),
  };
}

function cellAt(row: unknown[], index: number) {
  if (index < 0) return "";
  return row[index];
}

/** Parse AOA (header + data) into products. Continuation rows inherit PID/desc/status/inv. */
export function parseStatusEtaAoa(aoa: unknown[][]): StatusEtaProduct[] {
  if (!aoa.length) return [];

  const headerRowIndex = findStatusEtaHeaderRowIndex(aoa);
  const headerRow = aoa[headerRowIndex] || [];
  const headers = headerRow.map((c) => safeString(c));
  const cols = mapHeaders(headers);

  if (cols.pid < 0) {
    throw new Error("Missing PID / SKU column. Expected headers like PID, Description, Status, Aval. INV, Port ETA, Inbound QTY.");
  }

  const flats: FlatRow[] = [];
  let lastPid = "";
  let lastDescription = "";
  let lastStatus = "";
  let lastAvailableInv: number | null = null;

  for (let r = headerRowIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const rawPid = safeString(cellAt(row, cols.pid));
    const pid = normalizeInventorySku(rawPid) || lastPid;
    if (!pid) continue;

    const description = safeString(cellAt(row, cols.description)) || (rawPid ? "" : lastDescription);
    const status = safeString(cellAt(row, cols.status)) || (rawPid ? "" : lastStatus);
    const availableInvRaw = cellAt(row, cols.availableInv);
    const hasAvailableCell =
      typeof availableInvRaw === "number" || safeString(availableInvRaw) !== "";
    let availableInv: number | null;
    if (rawPid) {
      availableInv = parseSignedNumber(availableInvRaw);
    } else if (hasAvailableCell) {
      availableInv = parseSignedNumber(availableInvRaw);
    } else {
      availableInv = lastAvailableInv;
    }

    const portEta = cols.portEta >= 0 ? parseInventoryDate(cellAt(row, cols.portEta)) : null;
    const inboundQty = cols.inboundQty >= 0 ? parseSignedNumber(cellAt(row, cols.inboundQty)) : null;

    // Skip completely empty continuation noise
    if (!rawPid && !portEta && inboundQty == null && !safeString(cellAt(row, cols.description))) {
      continue;
    }

    if (rawPid) {
      lastPid = pid;
      lastDescription = description;
      lastStatus = status;
      lastAvailableInv = availableInv;
    }

    flats.push({
      pid,
      description: description || lastDescription,
      status: status || lastStatus,
      availableInv: availableInv ?? lastAvailableInv,
      portEta,
      inboundQty,
    });
  }

  const byPid = new Map<string, StatusEtaProduct>();
  for (const row of flats) {
    let product = byPid.get(row.pid);
    if (!product) {
      product = {
        pid: row.pid,
        description: row.description,
        status: row.status,
        availableInv: row.availableInv,
        inbound: [],
      };
      byPid.set(row.pid, product);
    } else {
      if (row.description && !product.description) product.description = row.description;
      if (row.status && !product.status) product.status = row.status;
      if (row.availableInv != null && product.availableInv == null) {
        product.availableInv = row.availableInv;
      }
    }

    if (row.portEta || row.inboundQty != null) {
      product.inbound.push({
        portEta: row.portEta,
        inboundQty: row.inboundQty,
      });
    }
  }

  return [...byPid.values()].sort((a, b) => a.pid.localeCompare(b.pid));
}

export function serializeStatusEtaProductsToCsv(products: StatusEtaProduct[]): string {
  const lines = ["PID,Description,Status,Aval. INV,Port ETA,Inbound QTY"];
  const esc = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${Number(m)}/${Number(d)}/${String(y).slice(-2)}`;
  };

  for (const product of products) {
    const inbound = product.inbound.length
      ? product.inbound
      : [{ portEta: null, inboundQty: null }];

    inbound.forEach((lot, index) => {
      const pid = index === 0 ? product.pid : "";
      const description = index === 0 ? product.description : "";
      const status = index === 0 ? product.status : "";
      const aval = index === 0 && product.availableInv != null ? String(product.availableInv) : "";
      lines.push(
        [
          esc(pid),
          esc(description),
          esc(status),
          aval,
          fmtDate(lot.portEta),
          lot.inboundQty != null ? String(lot.inboundQty) : "",
        ].join(",")
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

export function parseStatusEtaCsvText(text: string): StatusEtaProduct[] {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line));
  return parseStatusEtaAoa(rows);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function summarizeStatusEtaProducts(products: StatusEtaProduct[]) {
  return {
    rowCount: products.reduce((sum, p) => sum + Math.max(1, p.inbound.length), 0),
    skuCount: products.length,
  };
}

export function lookupStatusEtaProduct(
  products: StatusEtaProduct[],
  skuQuery: string
): StatusEtaLookupResult {
  const keys = new Set(skuLookupKeys(skuQuery).map((k) => k.toUpperCase()));
  const q = normalizeInventorySku(skuQuery);
  if (q) keys.add(q);

  for (const product of products) {
    const pidKeys = skuLookupKeys(product.pid);
    if (pidKeys.some((k) => keys.has(k)) || keys.has(product.pid.toUpperCase())) {
      return { pid: product.pid, found: true, product };
    }
  }

  return {
    pid: normalizeInventorySku(skuQuery) || safeString(skuQuery).toUpperCase(),
    found: false,
    product: null,
  };
}
