"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "admin_password";

type AdminAuthContextValue = {
  ready: boolean;
  authed: boolean;
  password: string;
  error: string;
  loading: boolean;
  setError: (msg: string) => void;
  login: (inputPassword: string) => Promise<boolean>;
  logout: () => void;
  adminHeaders: (extra?: Record<string, string>) => Record<string, string>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPassword(saved);
        setAuthed(true);
      }
    };

    syncFromStorage();
    setReady(true);

    const onVisible = () => {
      if (document.visibilityState === "visible") syncFromStorage();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", syncFromStorage);

    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", syncFromStorage);
    };
  }, []);

  const login = useCallback(async (inputPassword: string) => {
    const trimmed = inputPassword.trim();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Invalid admin password.");
      }

      sessionStorage.setItem(STORAGE_KEY, trimmed);
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
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setAuthed(false);
    setError("");
  }, []);

  const adminHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      "x-admin-password": password,
      ...extra,
    }),
    [password]
  );

  const value = useMemo(
    () => ({
      ready,
      authed,
      password,
      error,
      loading,
      setError,
      login,
      logout,
      adminHeaders,
    }),
    [ready, authed, password, error, loading, login, logout, adminHeaders]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
