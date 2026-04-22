"use client";

import { AuthUser } from "@/types";

// ─── API helpers (client-side) ────────────────────────────────────────────

export async function loginRequest(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Login failed");
  return data.data as { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
}

export async function registerRequest(payload: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Registration failed");
  return data.data as { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
}

export async function logoutRequest() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function getMeRequest(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? (data.data as AuthUser) : null;
}
