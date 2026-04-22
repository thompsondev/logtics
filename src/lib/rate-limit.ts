import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { ApiResponse } from "@/types";

interface RateLimitOptions {
  /** Key prefix, e.g. "track" */
  prefix: string;
  /** Window in seconds */
  windowSec: number;
  /** Max requests per window */
  max: number;
}

/**
 * Sliding-window rate limiter backed by Redis.
 * Returns null if the request is allowed, or a 429 NextResponse if throttled.
 */
export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<NextResponse<ApiResponse> | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `rl:${opts.prefix}:${ip}`;

  try {
    const redis = getRedisClient();
    const now = Date.now();
    const windowMs = opts.windowSec * 1000;

    // Remove counts outside the window, then add the current request
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, now - windowMs);
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    pipe.zcard(key);
    pipe.pexpire(key, windowMs);
    const results = await pipe.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > opts.max) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(opts.windowSec),
            "X-RateLimit-Limit": String(opts.max),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    return null; // allowed
  } catch (err) {
    // If Redis is down, fail open (allow the request)
    logger.warn("Rate limiter unavailable, failing open", "RateLimit", err);
    return null;
  }
}
