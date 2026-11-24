"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import {
  clearSavedAdminPassword,
  getSavedAdminPassword,
  persistAdminPassword,
  verifyAdminPassword,
} from "@/app/admin/_components/AdminAuthContext";

const STORAGE_KEY = "credit_access_password";
const REMEMBER_KEY = "credit_access_remember";

type CreditAuthContextValue = {
  ready: boolean;
  authed: boolean;
  password: string;
  error: string;
  loading: boolean;
  login: (inputPassword: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  creditHeaders: (extra?: Record<string, string>) => Record<string, string>;
};

const CreditAuthContext = createContext<CreditAuthContextValue | null>(null);

function readSavedCreditPassword() {
  try {
    const remembered = localStorage.getItem(REMEMBER_KEY) === "1";
    if (remembered) return localStorage.getItem(STORAGE_KEY) || "";
    return sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function readSavedPassword() {
  return getSavedAdminPassword() || readSavedCreditPassword();
}

function persistCreditPassword(password: string, rememberMe = true) {
  const trimmed = password.trim();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      localStorage.setItem(REMEMBER_KEY, "1");
    } else {
      sessionStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    /* ignore */
  }
}

function clearSavedCreditPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

function useCreditAuthState(): CreditAuthContextValue {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = readSavedPassword();
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (inputPassword: string, rememberMe = true) => {
    const trimmed = inputPassword.trim();
    setError("");
    setLoading(true);
    try {
      const admin = await verifyAdminPassword(trimmed);
      if (admin.ok) {
        persistAdminPassword(trimmed, rememberMe);
        persistCreditPassword(trimmed, rememberMe);
        setPassword(trimmed);
        setAuthed(true);
        return true;
      }

      const res = await fetch("/api/credit/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || admin.error || "Invalid password.");

      persistCreditPassword(trimmed, rememberMe);
      setPassword(trimmed);
      setAuthed(true);
      return true;
    } catch (err: unknown) {
      setAuthed(false);
      setError(err instanceof Error ? err.message : "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSavedCreditPassword();
    clearSavedAdminPassword();
    setPassword("");
    setAuthed(false);
    setError("");
  }, []);

  const creditHeaders = useCallback(
    (extra: Record<string, string> = {}) => ({
      "x-credit-password": password,
      "x-admin-password": password,
      ...extra,
    }),
    [password]
  );

  return { ready, authed, password, error, loading, login, logout, creditHeaders };
}

export function CreditAuthProvider({ children }: { children: ReactNode }) {
  const value = useCreditAuthState();
  return <CreditAuthContext.Provider value={value}>{children}</CreditAuthContext.Provider>;
}

export function useCreditAuth() {
  const ctx = useContext(CreditAuthContext);
  if (!ctx) throw new Error("useCreditAuth must be used within CreditAuthProvider");
  return ctx;
}
