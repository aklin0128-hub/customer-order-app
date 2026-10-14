"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ExpOfflinePack } from "@/lib/expOfflinePack";
import { suggestExpOffline } from "@/lib/expOfflinePack";
import { useExpAuth } from "./useExpAuth";

export type SkuSuggestRow = { sku: string; name: string };

export function ExpSkuAutocomplete({
  value,
  onChange,
  onPick,
  placeholder = "Type SKU or product name…",
  disabled,
  onEnter,
  offlinePack = null,
  preferOffline = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick?: (row: SkuSuggestRow) => void;
  placeholder?: string;
  disabled?: boolean;
  onEnter?: () => void;
  offlinePack?: ExpOfflinePack | null;
  preferOffline?: boolean;
}) {
  const { authed, expHeaders } = useExpAuth();
  const [results, setResults] = useState<SkuSuggestRow[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!authed || query.trim().length < 2) {
        setResults([]);
        return;
      }

      if (preferOffline && offlinePack) {
        const local = suggestExpOffline(offlinePack, query, 15);
        setResults(local);
        setOpen(local.length > 0);
        setActiveIdx(-1);
        return;
      }

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "15" });
        const res = await fetch(`/api/exp/sku-suggest?${params}`, { headers: expHeaders() });
        const json = await res.json();
        if (res.ok) {
          setResults(json.results || []);
          setOpen(true);
          setActiveIdx(-1);
          return;
        }
      } catch {
        /* fall through to offline */
      }

      if (offlinePack) {
        const local = suggestExpOffline(offlinePack, query, 15);
        setResults(local);
        setOpen(local.length > 0);
        setActiveIdx(-1);
        return;
      }

      setResults([]);
    },
    [authed, expHeaders, offlinePack, preferOffline]
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
  };

  return (
    <div ref={wrapRef} className="exp-autocomplete">
      <input
        className="exp-input"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (activeIdx >= 0 && results[activeIdx]) pick(results[activeIdx]);
            else onEnter?.();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {open && results.length > 0 ? (
        <ul className="exp-autocomplete-list" role="listbox">
          {results.map((row, i) => (
            <li key={row.sku}>
              <button
                type="button"
                className={i === activeIdx ? "is-active" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <span className="exp-autocomplete-sku">{row.sku}</span>
                <span className="exp-autocomplete-name">{row.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
