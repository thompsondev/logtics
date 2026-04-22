import { DataSource } from "typeorm";
import { Shipment } from "@/modules/shipments/entities/shipment.entity";
import { TrackingEvent } from "@/modules/tracking/entities/tracking-event.entity";
import { ShipmentStatus, ShippingMethod } from "@/types";

export type Granularity = "day" | "week" | "month";

export interface RevenueSeries {
  label: string;       // "2026-04-22" / "2026-W16" / "2026-04"
  revenue: number;
  count: number;
}

export interface StatusBreakdown {
  status: ShipmentStatus;
  count: number;
  pct: number;
}

export interface MethodBreakdown {
  method: ShippingMethod;
  count: number;
  revenue: number;
}

export interface TopRoute {
  origin: string;
  destination: string;
  count: number;
}

export interface DeliveryPerformance {
  successRate: number;        // % DELIVERED / (DELIVERED + FAILED + RETURNED)
  avgDaysToDeliver: number;   // average calendar days from CREATED → DELIVERED
  onTimeRate: number;         // % delivered on or before estimatedDelivery (0 if no estimates)
}

export interface AnalyticsResult {
  period: { from: string; to: string; granularity: Granularity };
  revenue: { total: number; series: RevenueSeries[] };
  shipments: { total: number; byStatus: StatusBreakdown[]; byMethod: MethodBreakdown[] };
  topRoutes: TopRoute[];
  performance: DeliveryPerformance;
}

export class AnalyticsService {
  constructor(private readonly ds: DataSource) {}

  async getAnalytics(opts: {
    from: Date;
    to: Date;
    granularity: Granularity;
  }): Promise<AnalyticsResult> {
    const { from, to, granularity } = opts;

    const [revenueSeries, byStatus, byMethod, topRoutes, performance] = await Promise.all([
      this.getRevenueSeries(from, to, granularity),
      this.getByStatus(from, to),
      this.getByMethod(from, to),
      this.getTopRoutes(from, to),
      this.getDeliveryPerformance(from, to),
    ]);

    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const totalRevenue = revenueSeries.reduce((sum, s) => sum + s.revenue, 0);

    return {
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        granularity,
      },
      revenue: { total: totalRevenue, series: revenueSeries },
      shipments: { total, byStatus, byMethod },
      topRoutes,
      performance,
    };
  }

  // ─── Revenue series ────────────────────────────────────────────────────────

  private async getRevenueSeries(
    from: Date,
    to: Date,
    granularity: Granularity,
  ): Promise<RevenueSeries[]> {
    // PostgreSQL date-trunc granularity mapping
    const trunc = granularity === "week" ? "week" : granularity === "month" ? "month" : "day";

    const rows = await this.ds
      .getRepository(Shipment)
      .createQueryBuilder("s")
      .select(`DATE_TRUNC('${trunc}', s."createdAt")`, "bucket")
      .addSelect("SUM(s.price)", "revenue")
      .addSelect("COUNT(s.id)", "count")
      .where("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .groupBy("bucket")
      .orderBy("bucket", "ASC")
      .getRawMany<{ bucket: string; revenue: string; count: string }>();

    return rows.map((r) => ({
      label: this.formatBucket(new Date(r.bucket), granularity),
      revenue: Number(r.revenue),
      count: Number(r.count),
    }));
  }

  // ─── Status breakdown ──────────────────────────────────────────────────────

  private async getByStatus(from: Date, to: Date): Promise<StatusBreakdown[]> {
    const rows = await this.ds
      .getRepository(Shipment)
      .createQueryBuilder("s")
      .select("s.status", "status")
      .addSelect("COUNT(s.id)", "count")
      .where("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .groupBy("s.status")
      .getRawMany<{ status: ShipmentStatus; count: string }>();

    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);

    // Include all statuses, defaulting missing ones to 0
    return Object.values(ShipmentStatus).map((s) => {
      const row = rows.find((r) => r.status === s);
      const count = row ? Number(row.count) : 0;
      return { status: s, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });
  }

  // ─── Method breakdown ──────────────────────────────────────────────────────

  private async getByMethod(from: Date, to: Date): Promise<MethodBreakdown[]> {
    const rows = await this.ds
      .getRepository(Shipment)
      .createQueryBuilder("s")
      .select("s.shippingMethod", "method")
      .addSelect("COUNT(s.id)", "count")
      .addSelect("SUM(s.price)", "revenue")
      .where("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .groupBy("s.shippingMethod")
      .getRawMany<{ method: ShippingMethod; count: string; revenue: string }>();

    return Object.values(ShippingMethod).map((m) => {
      const row = rows.find((r) => r.method === m);
      return {
        method: m,
        count: row ? Number(row.count) : 0,
        revenue: row ? Number(row.revenue) : 0,
      };
    });
  }

  // ─── Top routes ────────────────────────────────────────────────────────────

  private async getTopRoutes(from: Date, to: Date): Promise<TopRoute[]> {
    const rows = await this.ds
      .getRepository(Shipment)
      .createQueryBuilder("s")
      .leftJoin("s.origin", "o")
      .leftJoin("s.destination", "d")
      .select("o.city", "origin")
      .addSelect("d.city", "destination")
      .addSelect("COUNT(s.id)", "count")
      .where("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .groupBy("o.city")
      .addGroupBy("d.city")
      .orderBy("count", "DESC")
      .limit(10)
      .getRawMany<{ origin: string; destination: string; count: string }>();

    return rows.map((r) => ({
      origin: r.origin,
      destination: r.destination,
      count: Number(r.count),
    }));
  }

  // ─── Delivery performance ──────────────────────────────────────────────────

  private async getDeliveryPerformance(from: Date, to: Date): Promise<DeliveryPerformance> {
    const repo = this.ds.getRepository(Shipment);

    // Counts for delivered, failed, returned
    const outcomes = await repo
      .createQueryBuilder("s")
      .select("s.status", "status")
      .addSelect("COUNT(s.id)", "count")
      .where("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .andWhere("s.status IN (:...statuses)", {
        statuses: [ShipmentStatus.DELIVERED, ShipmentStatus.FAILED_DELIVERY, ShipmentStatus.RETURNED],
      })
      .groupBy("s.status")
      .getRawMany<{ status: ShipmentStatus; count: string }>();

    const get = (s: ShipmentStatus) =>
      Number(outcomes.find((r) => r.status === s)?.count ?? 0);

    const delivered = get(ShipmentStatus.DELIVERED);
    const failed = get(ShipmentStatus.FAILED_DELIVERY);
    const returned = get(ShipmentStatus.RETURNED);
    const terminal = delivered + failed + returned;
    const successRate = terminal > 0 ? Math.round((delivered / terminal) * 100) : 0;

    // Average days CREATED → first DELIVERED tracking event
    const avgRow = await this.ds
      .getRepository(TrackingEvent)
      .createQueryBuilder("te")
      .innerJoin("te.shipment", "s")
      .select(
        `AVG(EXTRACT(EPOCH FROM (te."createdAt" - s."createdAt")) / 86400)`,
        "avg_days",
      )
      .where("te.status = :status", { status: ShipmentStatus.DELIVERED })
      .andWhere("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .getRawOne<{ avg_days: string | null }>();

    const avgDaysToDeliver = avgRow?.avg_days ? Math.round(Number(avgRow.avg_days) * 10) / 10 : 0;

    // On-time rate: delivered on or before estimatedDelivery
    const onTimeRow = await repo
      .createQueryBuilder("s")
      .select("COUNT(s.id)", "count")
      .where("s.status = :status", { status: ShipmentStatus.DELIVERED })
      .andWhere("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .andWhere("s.estimatedDelivery IS NOT NULL")
      .andWhere('s."actualDelivery" <= s."estimatedDelivery"')
      .getRawOne<{ count: string }>();

    const onTimeDelivered = Number(onTimeRow?.count ?? 0);
    const eligibleForOnTime = await repo
      .createQueryBuilder("s")
      .where("s.status = :status", { status: ShipmentStatus.DELIVERED })
      .andWhere("s.createdAt >= :from AND s.createdAt <= :to", { from, to })
      .andWhere("s.estimatedDelivery IS NOT NULL")
      .getCount();

    const onTimeRate =
      eligibleForOnTime > 0 ? Math.round((onTimeDelivered / eligibleForOnTime) * 100) : 0;

    return { successRate, avgDaysToDeliver, onTimeRate };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private formatBucket(date: Date, granularity: Granularity): string {
    if (granularity === "month") {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    if (granularity === "week") {
      const week = this.isoWeek(date);
      return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    }
    // day
    return date.toISOString().slice(0, 10);
  }

  private isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
