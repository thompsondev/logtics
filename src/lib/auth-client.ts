"use client";

import { AuthUser } from "@/types";

// ─── API helpers (client-side) ────────────────────────────────────────────

async function parseApiResponse(res: Response): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const text = await res.text();
  if (!text) return { success: false, error: "Empty response from server" };

  try {
    return JSON.parse(text) as { success: boolean; data?: unknown; error?: string };
  } catch {
    return {
      success: false,
      error: res.ok ? "Unexpected server response" : "Request failed. Please try again.",
    };
  }
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  const data = await parseApiResponse(res);
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
  const data = await parseApiResponse(res);
  if (!data.success) throw new Error(data.error ?? "Registration failed");
  return data.data as { user: AuthUser; tokens: { accessToken: string; refreshToken: string } };
}

export async function logoutRequest() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function getMeRequest(): Promise<AuthUser | null> {
  try {
    // Abort if the server takes more than 8 s — prevents infinite spinner
    // during Next.js dev cold-start compilation of heavy route bundles.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? (data.data as AuthUser) : null;
  } catch {
    // Network error, timeout, or non-JSON body — treat as not logged in
    return null;
  }
}
