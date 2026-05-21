"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { inputStyle } from "./admin-styles";
import { useAdminAuth } from "./useAdminAuth";

type SearchResult =
  | { type: "account"; accountNo: string; storeName: string; href: string; label?: string }
  | { type: "sku"; sku: string; name: string; href: string; label?: string }
  | { type: "order"; accountNo: string; orderRef: string; createdAt: string; href: string; label?: string }
  | { type: "invoice"; id: string; accountNo: string; invoiceNo: string; href: string; label?: string };

function resultKey(r: SearchResult) {
  if (r.type === "account") return `a-${r.accountNo}`;
  if (r.type === "sku") return `s-${r.sku}`;
  if (r.type === "order") return `o-${r.accountNo}-${r.orderRef}-${r.createdAt}`;
  return `i-${r.id}`;
}

export function AdminGlobalSearch() {
  const { authed, adminHeaders } = useAdminAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (query: string) => {
      if (!authed || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}&limit=16`, {
          headers: adminHeaders(),
        });
        const json = await res.json();
        if (res.ok) {
          setResults(json.results || []);
          setActiveIdx(-1);
        }
      } catch {
        setResults([]);
      }
    },
    [authed, adminHeaders]
  );

  useEffect(() => {
    const t = setTimeout(() => void search(q), 200);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  if (!authed) return null;

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={wrapRef} className="admin-global-search">
      <input
        type="search"
        placeholder="Account, SKU, order, invoice…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "Enter" && activeIdx >= 0 && results[activeIdx]) {
            e.preventDefault();
            window.location.href = results[activeIdx].href;
            close();
            return;
          }
          if (!showPanel || !results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
          }
        }}
        className="admin-global-search-input"
        style={{ ...inputStyle, width: "100%", fontSize: 13 }}
        aria-label="Admin search"
        aria-expanded={showPanel}
        autoComplete="off"
      />
      {showPanel ? (
        results.length > 0 ? (
          <ul className="admin-search-results" role="listbox">
            {results.map((r, i) => (
              <li key={resultKey(r)} role="option" aria-selected={i === activeIdx}>
                <Link
                  href={r.href}
                  onClick={close}
                  className={`admin-search-result-link${i === activeIdx ? " admin-search-result-link--active" : ""}`}
                >
                  <span className="admin-search-result-type">{r.label || r.type}</span>
                  {r.type === "account" ? (
                    <>
                      <strong>{r.accountNo}</strong> · {r.storeName || "—"}
                    </>
                  ) : null}
                  {r.type === "sku" ? (
                    <>
                      <strong>{r.sku}</strong>
                      {r.name ? ` · ${r.name}` : ""}
                    </>
                  ) : null}
                  {r.type === "order" ? (
                    <>
                      <strong>{r.orderRef}</strong> · {r.accountNo}
                      {r.createdAt ? ` · ${r.createdAt.slice(0, 10)}` : ""}
                    </>
                  ) : null}
                  {r.type === "invoice" ? (
                    <>
                      <strong>{r.invoiceNo}</strong> · {r.accountNo}
                    </>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-search-results admin-search-results--empty">No matches</div>
        )
      ) : null}
    </div>
  );
}
