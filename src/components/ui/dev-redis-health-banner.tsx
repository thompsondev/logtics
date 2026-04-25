"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  status: "ok" | "degraded";
  redis?: {
    status: "ok" | "degraded";
    latencyMs: number | null;
    error?: string;
  };
};

export function DevRedisHealthBanner() {
  const [redis, setRedis] = useState<HealthResponse["redis"]>();
  const [failedToFetch, setFailedToFetch] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as HealthResponse;
        if (!cancelled) {
          setRedis(data.redis);
          setFailedToFetch(!res.ok && !data.redis);
        }
      } catch {
        if (!cancelled) {
          setFailedToFetch(true);
        }
      }
    };

    checkHealth().catch(() => null);
    const timer = setInterval(() => {
      checkHealth().catch(() => null);
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const isDegraded = failedToFetch || redis?.status === "degraded";
  if (!isDegraded) return null;

  const details = failedToFetch
    ? "Health check unreachable"
    : redis?.error ?? "Redis unavailable";

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 shadow-lg backdrop-blur">
      <p className="font-semibold">Dev Notice: Redis degraded</p>
      <p className="mt-0.5 text-amber-100/90">{details}</p>
    </div>
  );
}
