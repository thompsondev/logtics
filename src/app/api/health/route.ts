import { NextResponse } from "next/server";
import { wsManager } from "@/lib/realtime/ws-manager";
import { getRedisClient } from "@/lib/redis";

type ServiceStatus = "ok" | "degraded";
const REDIS_PING_TIMEOUT_MS = 1500;
const isProduction = process.env.NODE_ENV === "production";

async function checkRedis(): Promise<{ status: ServiceStatus; latencyMs: number | null; error?: string }> {
  const startedAt = Date.now();
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const redis = getRedisClient();

    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Redis ping timeout")), REDIS_PING_TIMEOUT_MS);
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);

    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    return {
      status: "degraded",
      latencyMs: null,
      error: !isProduction && error instanceof Error ? error.message : "Service unavailable",
    };
  }
}

export async function GET() {
  const redis = await checkRedis();
  const status: ServiceStatus = redis.status === "ok" ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      redis,
      realtime: {
        connections: wsManager.connectionCount,
        subscriptions: wsManager.subscriptionCount,
      },
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
