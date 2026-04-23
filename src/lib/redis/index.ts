import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    // ioredis handles rediss:// (TLS) automatically when given a URL string,
    // but Upstash requires the tls option to be explicit when passing an options
    // object. Detect the scheme and add tls: {} if needed.
    const isTls = env.REDIS_URL.startsWith("rediss://");
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
    });

    const REDIS_NOISE = ["econnrefused", "tls", "etimedout", "econnreset", "socket hang up"];
    redisClient.on("connect", () => logger.info("Redis connected", "Redis"));
    redisClient.on("ready", () => logger.info("Redis ready", "Redis"));
    redisClient.on("error", (err: Error) => {
      const msg = err.message.toLowerCase();
      if (REDIS_NOISE.some((p) => msg.includes(p))) {
        logger.warn(`Redis unavailable — ${err.message}`, "Redis");
      } else {
        logger.error("Redis error", "Redis", err);
      }
    });
    redisClient.on("close", () => logger.warn("Redis connection closed", "Redis"));
  }
  return redisClient;
}

// ─── Generic cache helpers ────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedisClient();
  await client.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function cacheDel(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

/**
 * Delete all keys matching a pattern using SCAN instead of KEYS.
 * KEYS is O(N) and blocks the event loop on large keyspaces.
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  let cursor = "0";
  const toDelete: string[] = [];

  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    toDelete.push(...keys);
  } while (cursor !== "0");

  if (toDelete.length > 0) {
    // del accepts spread args; chunk to avoid hitting argument limits
    const chunkSize = 100;
    for (let i = 0; i < toDelete.length; i += chunkSize) {
      await client.del(...toDelete.slice(i, i + chunkSize));
    }
  }
}

// ─── Refresh token revocation (jti allowlist) ─────────────────────────────
// We store each valid jti in Redis with a TTL matching the refresh token expiry.
// On rotation the old jti is deleted; on logout all user jtis are cleaned up.

const REFRESH_JTI_PREFIX = "rt:jti:";
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30 days — mirrors JWT_REFRESH_EXPIRES_IN

export async function storeRefreshJti(userId: string, jti: string): Promise<void> {
  const client = getRedisClient();
  await client.setex(`${REFRESH_JTI_PREFIX}${jti}`, REFRESH_TTL_SEC, userId);
}

export async function consumeRefreshJti(jti: string): Promise<string | null> {
  const client = getRedisClient();
  // DEL returns the value atomically via a pipeline
  const pipe = client.pipeline();
  pipe.get(`${REFRESH_JTI_PREFIX}${jti}`);
  pipe.del(`${REFRESH_JTI_PREFIX}${jti}`);
  const results = await pipe.exec();
  return (results?.[0]?.[1] as string | null) ?? null;
}

export async function revokeRefreshJti(jti: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`${REFRESH_JTI_PREFIX}${jti}`);
}

// ─── Access token blocklist (for logout) ─────────────────────────────────
// We track access token jti → expiry until the token naturally expires.

const ACCESS_BLOCKLIST_PREFIX = "at:block:";

export async function blockAccessToken(jti: string, expiresInSec: number): Promise<void> {
  const client = getRedisClient();
  await client.setex(`${ACCESS_BLOCKLIST_PREFIX}${jti}`, expiresInSec, "1");
}

export async function isAccessTokenBlocked(jti: string): Promise<boolean> {
  const client = getRedisClient();
  const val = await client.exists(`${ACCESS_BLOCKLIST_PREFIX}${jti}`);
  return val === 1;
}

// ─── Per-account login lockout ────────────────────────────────────────────

const LOCKOUT_PREFIX = "lockout:";
const LOCKOUT_WINDOW_SEC = 15 * 60;   // 15-minute window
const LOCKOUT_MAX_ATTEMPTS = 10;

export async function recordFailedLogin(email: string): Promise<number> {
  const client = getRedisClient();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
  const pipe = client.pipeline();
  pipe.incr(key);
  pipe.expire(key, LOCKOUT_WINDOW_SEC);
  const results = await pipe.exec();
  return (results?.[0]?.[1] as number) ?? 1;
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const client = getRedisClient();
  const val = await client.get(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
  return val !== null && parseInt(val, 10) >= LOCKOUT_MAX_ATTEMPTS;
}

export async function clearFailedLogins(email: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
}
