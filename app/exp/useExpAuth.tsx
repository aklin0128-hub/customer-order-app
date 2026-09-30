"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "exp_access_password";
const REMEMBER_KEY = "exp_access_remember";

type ExpAuthContextValue = {
  ready: boolean;
  authed: boolean;
  password: string;
  error: string;
  loading: boolean;
  login: (inputPassword: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  expHeaders: (extra?: HeadersInit) => HeadersInit;
};

const ExpAuthContext = createContext<ExpAuthContextValue | null>(null);

function readSavedPassword() {
  try {
    const remembered = localStorage.getItem(REMEMBER_KEY) === "1";
    if (remembered) {
      return localStorage.getItem(STORAGE_KEY) || "";
    }
    return sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function clearSavedPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

function useExpAuthState(): ExpAuthContextValue {
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
      const res = await fetch("/api/exp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Invalid password.");
      }

      clearSavedPassword();
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, trimmed);
        localStorage.setItem(REMEMBER_KEY, "1");
      } else {
        sessionStorage.setItem(STORAGE_KEY, trimmed);
        localStorage.setItem(REMEMBER_KEY, "0");
      }

      setPassword(trimmed);
      setAuthed(true);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSavedPassword();
    setPassword("");
    setAuthed(false);
  }, []);

  const expHeaders = useCallback(
    (extra?: HeadersInit): HeadersInit => ({
      "x-exp-password": password,
      ...extra,
    }),
    [password]
  );

  return { ready, authed, password, error, loading, login, logout, expHeaders };
}

export function ExpAuthProvider({ children }: { children: ReactNode }) {
  const value = useExpAuthState();
  return <ExpAuthContext.Provider value={value}>{children}</ExpAuthContext.Provider>;
}

export function useExpAuth() {
  const ctx = useContext(ExpAuthContext);
  if (!ctx) {
    throw new Error("useExpAuth must be used within ExpAuthProvider");
  }
  return ctx;
}
