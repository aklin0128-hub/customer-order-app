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
const REMEMBER_KEY = "admin_access_remember";

type AdminAuthContextValue = {
  ready: boolean;
  authed: boolean;
  password: string;
  error: string;
  loading: boolean;
  setError: (msg: string) => void;
  login: (inputPassword: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  adminHeaders: (extra?: Record<string, string>) => Record<string, string>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readSavedAdminPassword() {
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) return fromSession;
    if (localStorage.getItem(REMEMBER_KEY) === "1") {
      const saved = localStorage.getItem(STORAGE_KEY) || "";
      if (saved) sessionStorage.setItem(STORAGE_KEY, saved);
      return saved;
    }
    return "";
  } catch {
    return "";
  }
}

function clearSavedAdminPassword() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

/** Used outside AdminAuthProvider (e.g. order page admin edit links). */
export function hasSavedAdminPassword() {
  return Boolean(readSavedAdminPassword());
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      const saved = readSavedAdminPassword();
      if (saved) {
        setPassword(saved);
        setAuthed(true);
      } else {
        setPassword("");
        setAuthed(false);
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

  const login = useCallback(async (inputPassword: string, rememberMe = true) => {
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

      clearSavedAdminPassword();
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, trimmed);
        localStorage.setItem(REMEMBER_KEY, "1");
      } else {
        sessionStorage.setItem(STORAGE_KEY, trimmed);
        localStorage.setItem(REMEMBER_KEY, "0");
      }
      // Keep sessionStorage in sync for pages that read it directly.
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
    clearSavedAdminPassword();
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
