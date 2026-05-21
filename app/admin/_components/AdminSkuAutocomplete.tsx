"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { inputStyle } from "./admin-styles";
import { useAdminAuth } from "./useAdminAuth";

export type SkuSuggestRow = { sku: string; name: string };

export function AdminSkuAutocomplete({
  value,
  onChange,
  onPick,
  placeholder = "Type SKU or name…",
  disabled,
  minChars = 2,
  limit = 15,
  includeInventory = false,
  inputStyle: styleOverride,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (row: SkuSuggestRow) => void;
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
  limit?: number;
  /** Also match SKUs from uploaded inventory file */
  includeInventory?: boolean;
  inputStyle?: CSSProperties;
  onEnter?: () => void;
}) {
  const { authed, adminHeaders } = useAdminAuth();
  const [results, setResults] = useState<SkuSuggestRow[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!authed || query.trim().length < minChars) {
        setResults([]);
        return;
      }
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          limit: String(limit),
        });
        if (includeInventory) params.set("inventory", "1");
        const res = await fetch(`/api/admin/sku-suggest?${params}`, { headers: adminHeaders() });
        const json = await res.json();
        if (res.ok) {
          setResults(json.results || []);
          setOpen(true);
          setActiveIdx(-1);
        }
      } catch {
        setResults([]);
      }
    },
    [authed, adminHeaders, minChars, limit, includeInventory]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (row: SkuSuggestRow) => {
    onChange(row.sku);
    onPick?.(row);
    setOpen(false);
    setResults([]);
  };

  const clear = () => {
    onChange("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="admin-sku-autocomplete">
      <div className="admin-sku-autocomplete-input-wrap">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
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
              return;
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
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
        />
        {value ? (
          <button
            type="button"
            className="admin-sku-autocomplete-clear"
            aria-label="Clear"
            onClick={clear}
            tabIndex={-1}
          >
            ×
          </button>
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul className="admin-sku-autocomplete-results" role="listbox">
          {results.map((row, i) => (
            <li key={row.sku} role="option" aria-selected={i === activeIdx}>
              <button
                type="button"
                className={`admin-sku-autocomplete-option${i === activeIdx ? " admin-sku-autocomplete-option--active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <strong>{row.sku}</strong>
                {row.name ? <span> · {row.name}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
