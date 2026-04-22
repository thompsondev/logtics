"use client";

import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ShipmentStatus } from "@/types";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface ShipmentStats {
  total: number;
  byStatus: Record<string, number>;
  revenue: number;
  todayCount: number;
}

interface RecentShipment {
  id: string;
  trackingNumber: string;
  status: ShipmentStatus;
  receiver: { name: string };
  origin: { city: string; country: string };
  destination: { city: string; country: string };
  price: number;
  currency: string;
  createdAt: string;
}

/* ── Fetch helpers ───────────────────────────────────────────────────────── */

async function fetchStats(): Promise<ShipmentStats> {
  const res = await fetch("/api/admin/stats", { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as ShipmentStats;
}

async function fetchRecent(): Promise<RecentShipment[]> {
  const res = await fetch("/api/shipments?pageSize=8&sortBy=createdAt&sortOrder=DESC", {
    credentials: "include",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return (json.data as { data: RecentShipment[] }).data;
}

/* ── Stat card config ────────────────────────────────────────────────────── */

interface StatCardDef {
  label: string;
  getValue: (s: ShipmentStats) => string | number;
  sub?: (s: ShipmentStats) => string;
  accent: string;
  icon: string;
}

const STAT_CARDS: StatCardDef[] = [
  {
    label: "Total Shipments",
    getValue: (s) => s.total.toLocaleString(),
    sub: (s) => `${s.todayCount} created today`,
    accent: "text-blue-400",
    icon: "📦",
  },
  {
    label: "In Transit",
    getValue: (s) =>
      ((s.byStatus[ShipmentStatus.IN_TRANSIT] ?? 0) +
        (s.byStatus[ShipmentStatus.PICKED_UP] ?? 0) +
        (s.byStatus[ShipmentStatus.ARRIVED_AT_HUB] ?? 0) +
        (s.byStatus[ShipmentStatus.OUT_FOR_DELIVERY] ?? 0)
      ).toLocaleString(),
    sub: (s) => `${s.byStatus[ShipmentStatus.OUT_FOR_DELIVERY] ?? 0} out for delivery`,
    accent: "text-yellow-400",
    icon: "🚚",
  },
  {
    label: "Delivered",
    getValue: (s) => (s.byStatus[ShipmentStatus.DELIVERED] ?? 0).toLocaleString(),
    sub: (s) => {
      const pct = s.total > 0
        ? Math.round(((s.byStatus[ShipmentStatus.DELIVERED] ?? 0) / s.total) * 100)
        : 0;
      return `${pct}% success rate`;
    },
    accent: "text-green-400",
    icon: "✅",
  },
  {
    label: "Issues",
    getValue: (s) =>
      ((s.byStatus[ShipmentStatus.FAILED_DELIVERY] ?? 0) +
        (s.byStatus[ShipmentStatus.RETURNED] ?? 0)
      ).toLocaleString(),
    sub: (s) => `${s.byStatus[ShipmentStatus.RETURNED] ?? 0} returned`,
    accent: "text-red-400",
    icon: "⚠️",
  },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AdminOverviewPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchStats,
    refetchInterval: 30_000,
  });

  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-shipments"],
    queryFn: fetchRecent,
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <Header
        title="Overview"
        subtitle="Platform health at a glance"
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.label} def={card} stats={stats} loading={statsLoading} />
        ))}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatusBreakdown stats={stats} loading={statsLoading} />
        <RecentShipments rows={recent} loading={recentLoading} />
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({
  def,
  stats,
  loading,
}: {
  def: StatCardDef;
  stats?: ShipmentStats;
  loading: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl">{def.icon}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
          {def.label}
        </span>
      </div>
      {loading || !stats ? (
        <div className="h-8 w-20 bg-gray-800 rounded-lg animate-pulse mb-1" />
      ) : (
        <p className={`text-3xl font-bold ${def.accent}`}>{def.getValue(stats)}</p>
      )}
      {loading || !stats ? (
        <div className="h-3 w-28 bg-gray-800 rounded animate-pulse mt-2" />
      ) : (
        <p className="text-xs text-gray-500 mt-1">{def.sub?.(stats)}</p>
      )}
    </div>
  );
}

function StatusBreakdown({
  stats,
  loading,
}: {
  stats?: ShipmentStats;
  loading: boolean;
}) {
  const statuses = Object.values(ShipmentStatus);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Shipments by Status</h3>
      {loading || !stats ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {statuses.map((s) => {
            const count = stats.byStatus[s] ?? 0;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <StatusBadge status={s} size="sm" />
                <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentShipments({
  rows,
  loading,
}: {
  rows?: RecentShipment[];
  loading: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Recent Shipments</h3>
        <a
          href="/admin/shipments"
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          View all →
        </a>
      </div>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !rows?.length ? (
        <p className="text-sm text-gray-500 text-center py-6">No shipments yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-800/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-blue-400 truncate">{s.trackingNumber}</p>
                <p className="text-xs text-gray-500 truncate">
                  {s.receiver.name} · {s.origin.city} → {s.destination.city}
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <StatusBadge status={s.status} size="sm" />
                <p className="text-xs text-gray-600 mt-0.5">
                  {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
