import { NextRequest } from "next/server";
import { z } from "zod";
import { getDataSource } from "@/lib/db";
import { AnalyticsService, Granularity } from "@/modules/analytics";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { cacheGet, cacheSet } from "@/lib/redis";
import { CACHE_TTL } from "@/config/constants";
import { UserRole } from "@/types";

const QuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

export const GET = withAuth(async (req: AuthedRequest) => {
  const deny = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const raw = Object.fromEntries(searchParams.entries());
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const granularity = parsed.data.granularity as Granularity;

  // Default: last 30 days
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const cacheKey = `analytics:${granularity}:${from.toISOString().slice(0, 10)}:${to.toISOString().slice(0, 10)}`;

  try {
    // Cache analytics — 5 min TTL
    const cached = await cacheGet(cacheKey);
    if (cached) return ok(cached);

    const ds = await getDataSource();
    const service = new AnalyticsService(ds);
    const result = await service.getAnalytics({ from, to, granularity });

    await cacheSet(cacheKey, result, CACHE_TTL.ANALYTICS);
    return ok(result);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Analytics query failed");
  }
});
