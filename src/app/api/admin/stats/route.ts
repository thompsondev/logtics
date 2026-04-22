import { getDataSource } from "@/lib/db";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";
import { withAuth, requireRole, AuthedRequest } from "@/lib/with-auth";
import { ok, serverError } from "@/lib/api-response";
import { cacheGet, cacheSet } from "@/lib/redis";
import { UserRole, ShipmentStatus } from "@/types";

export interface ShipmentStats {
  total: number;
  byStatus: Record<string, number>;
  revenue: number;
  todayCount: number;
}

// Cache key rotates every minute so today-count stays fresh
const STATS_CACHE_KEY = () =>
  `admin:stats:${new Date().toISOString().slice(0, 16)}`; // "2026-04-22T10:20"

export const GET = withAuth(async (req: AuthedRequest) => {
  const deny = requireRole(req.user, UserRole.ADMIN, UserRole.STAFF);
  if (deny) return deny;

  const cacheKey = STATS_CACHE_KEY();

  try {
    const cached = await cacheGet<ShipmentStats>(cacheKey);
    if (cached) return ok(cached);

    const ds = await getDataSource();
    const repo = ds.getRepository(Shipment);

    const totals = await repo
      .createQueryBuilder("s")
      .select("COUNT(s.id)", "total")
      .addSelect("COALESCE(SUM(s.price), 0)", "revenue")
      .getRawOne<{ total: string; revenue: string }>();

    const byCounts = await repo
      .createQueryBuilder("s")
      .select("s.status", "status")
      .addSelect("COUNT(s.id)", "count")
      .groupBy("s.status")
      .getRawMany<{ status: string; count: string }>();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayCount = await repo
      .createQueryBuilder("s")
      .where("s.createdAt >= :start", { start: todayStart })
      .getCount();

    const byStatus: Record<string, number> = {};
    for (const s of Object.values(ShipmentStatus)) byStatus[s] = 0;
    for (const row of byCounts) byStatus[row.status] = Number(row.count);

    const stats: ShipmentStats = {
      total: Number(totals?.total ?? 0),
      byStatus,
      revenue: Number(totals?.revenue ?? 0),
      todayCount,
    };

    // Cache for 60 s — key already rotates every minute
    await cacheSet(cacheKey, stats, 60);
    return ok(stats);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Failed to load stats");
  }
});
