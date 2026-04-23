"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AuthUser } from "@/types";
import { getMeRequest, logoutRequest } from "./auth-client";

interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

const STORAGE_KEY = "logtics_user";

function readCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing etc.) — safe to ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const me = await getMeRequest();
    setUser(me);
    writeCachedUser(me);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    writeCachedUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    // ── Phase 1: instant render ───────────────────────────────────────────
    // Restore cached user (or null) from localStorage so the page renders
    // immediately without a spinner.  Works for both logged-in users
    // (shows the right UI) and logged-out users (shows login form at once).
    const cached = readCachedUser();
    setUser(cached);
    setLoading(false);

    // ── Phase 2: background server verification ───────────────────────────
    // Silently re-checks the session against the server.
    // • Valid session  → updates user in context (may redirect to dashboard)
    // • Expired/gone   → clears user + cache (may redirect to login)
    // The spinner is already gone by this point — no UI flicker.
    refresh().catch(() => null);
  }, [refresh]);

  return <Ctx.Provider value={{ user, loading, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
