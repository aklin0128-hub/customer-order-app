"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { inputStyle } from "./admin-styles";
import { useAdminAuth } from "./useAdminAuth";

type AccountHit = { accountNo: string; storeName: string };

export function AdminAccountAutocomplete({
  value,
  onChange,
  onPick,
  placeholder = "Account # or store name…",
  disabled,
  onEnter,
  inputStyle: styleOverride,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (row: AccountHit) => void;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  inputStyle?: CSSProperties;
}) {
  const { authed, adminHeaders } = useAdminAuth();
  const [results, setResults] = useState<AccountHit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchAccounts = useCallback(
    async (query: string) => {
      if (!authed || query.trim().length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query.trim())}&types=account&limit=12`,
          { headers: adminHeaders() }
        );
        const json = await res.json();
        if (res.ok) {
          const rows = (json.results || [])
            .filter((r: { type: string }) => r.type === "account")
            .map((r: { accountNo: string; storeName: string }) => ({
              accountNo: r.accountNo,
              storeName: r.storeName,
            }));
          setResults(rows);
          setOpen(true);
          setActiveIdx(-1);
        }
      } catch {
        setResults([]);
      }
    },
    [authed, adminHeaders]
  );

  useEffect(() => {
    const t = setTimeout(() => void fetchAccounts(value), 200);
    return () => clearTimeout(t);
  }, [value, fetchAccounts]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (row: AccountHit) => {
    onChange(row.accountNo);
    onPick?.(row);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="admin-sku-autocomplete">
      <div className="admin-sku-autocomplete-input-wrap">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (e.key === "Enter") {
              if (open && activeIdx >= 0 && results[activeIdx]) {
                e.preventDefault();
                pick(results[activeIdx]);
                return;
              }
              onEnter?.();
            }
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => (i + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="admin-sku-autocomplete-input"
          style={{ ...inputStyle, ...(styleOverride || {}) }}
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            className="admin-sku-autocomplete-clear"
            aria-label="Clear"
            onClick={() => onChange("")}
          >
            ×
          </button>
        ) : null}
      </div>
      {open && results.length > 0 ? (
        <ul className="admin-sku-autocomplete-results" role="listbox">
          {results.map((row, i) => (
            <li key={row.accountNo} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                className={`admin-sku-autocomplete-option${i === activeIdx ? " admin-sku-autocomplete-option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <strong>{row.accountNo}</strong>
                {row.storeName ? <span> · {row.storeName}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
