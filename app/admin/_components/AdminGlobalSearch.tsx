"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { inputStyle } from "./admin-styles";
import { useAdminAuth } from "./useAdminAuth";

type SearchResult =
  | { type: "account"; accountNo: string; storeName: string; href: string }
  | { type: "sku"; sku: string; name: string; href: string };

export function AdminGlobalSearch() {
  const { authed, adminHeaders } = useAdminAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    async (query: string) => {
      if (!authed || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          headers: adminHeaders(),
        });
        const json = await res.json();
        if (res.ok) setResults(json.results || []);
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

  if (!authed) return null;

  return (
    <div ref={wrapRef} className="admin-global-search" style={{ position: "relative", minWidth: 200, flex: 1, maxWidth: 360 }}>
      <input
        type="search"
        placeholder="Search account or SKU…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        style={{ ...inputStyle, width: "100%", fontSize: 13 }}
        aria-label="Admin search"
      />
      {open && q.trim().length >= 2 && results.length > 0 ? (
        <ul
          className="admin-search-results"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            margin: "6px 0 0",
            padding: 6,
            listStyle: "none",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <li key={r.type === "account" ? r.accountNo : r.sku}>
              <Link
                href={r.href}
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
                style={{
                  display: "block",
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#111827",
                  textDecoration: "none",
                }}
              >
                {r.type === "account" ? (
                  <>
                    <strong>{r.accountNo}</strong> · {r.storeName || "—"}
                  </>
                ) : (
                  <>
                    <strong>{r.sku}</strong>
                    {r.name ? ` · ${r.name}` : ""}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
