"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import type { AnalyticsResult } from "@/modules/analytics";

/* ── Fetch ───────────────────────────────────────────────────────────────── */

type Granularity = "day" | "week" | "month";
type Range = "7d" | "30d" | "90d" | "custom";

const RANGE_DAYS: Record<Exclude<Range, "custom">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

async function fetchAnalytics(
  from: string,
  to: string,
  granularity: Granularity,
): Promise<AnalyticsResult> {
  const qs = new URLSearchParams({ from, to, granularity }).toString();
  const res = await fetch(`/api/analytics?${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as AnalyticsResult;
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");

  const to = new Date().toISOString();
  const from =
    range !== "custom"
      ? new Date(Date.now() - RANGE_DAYS[range] * 86400000).toISOString()
      : new Date(Date.now() - 30 * 86400000).toISOString(); // fallback

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", from, to, granularity],
    queryFn: () => fetchAnalytics(from, to, granularity),
    staleTime: 5 * 60 * 1000, // 5 min — matches server cache
  });

  return (
    <div className="space-y-6">
      <Header
        title="Analytics"
        subtitle="Platform performance and trends"
        action={
          <div className="flex items-center gap-2">
            {/* Granularity */}
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
            {/* Range */}
            <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {(["7d", "30d", "90d"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-2 text-xs transition-colors
                    ${range === r ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : isError ? (
        <div className="p-8 text-center text-red-400 text-sm bg-gray-900 border border-gray-800 rounded-2xl">
          Failed to load analytics.
        </div>
      ) : data ? (
        <AnalyticsView data={data} />
      ) : null}
    </div>
  );
}

/* ── Analytics view ──────────────────────────────────────────────────────── */

function AnalyticsView({ data }: { data: AnalyticsResult }) {
  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue"
          value={`$${data.revenue.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon="💰"
          accent="text-green-400"
        />
        <KpiCard
          label="Total Shipments"
          value={data.shipments.total.toLocaleString()}
          icon="📦"
          accent="text-blue-400"
        />
        <KpiCard
          label="Success Rate"
          value={`${data.performance.successRate}%`}
          icon="✅"
          accent="text-emerald-400"
        />
        <KpiCard
          label="Avg Days to Deliver"
          value={data.performance.avgDaysToDeliver > 0 ? `${data.performance.avgDaysToDeliver}d` : "—"}
          icon="⏱️"
          accent="text-yellow-400"
          sub={data.performance.onTimeRate > 0 ? `${data.performance.onTimeRate}% on-time` : undefined}
        />
      </div>

      {/* Revenue series + top routes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RevenueSeries data={data} />
        <TopRoutes data={data} />
      </div>

      {/* Status + method breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StatusBreakdown data={data} />
        <MethodBreakdown data={data} />
      </div>
    </div>
  );
}

/* ── KPI card ────────────────────────────────────────────────────────────── */

function KpiCard({
  label, value, icon, accent, sub,
}: {
  label: string; value: string; icon: string; accent: string; sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Revenue series (ASCII spark) ────────────────────────────────────────── */

function RevenueSeries({ data }: { data: AnalyticsResult }) {
  const series = data.revenue.series;
  const maxRevenue = Math.max(...series.map((s) => s.revenue), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Revenue Trend</h3>
      {series.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No data for this period.</p>
      ) : (
        <div className="space-y-2">
          {series.slice(-14).map((s) => {
            const bar = Math.max(Math.round((s.revenue / maxRevenue) * 100), s.revenue > 0 ? 2 : 0);
            return (
              <div key={s.label} className="flex items-center gap-3 text-xs">
                <span className="text-gray-500 w-24 flex-shrink-0 text-right">{s.label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${bar}%` }}
                  />
                </div>
                <span className="text-gray-400 w-20 text-right">
                  ${s.revenue.toFixed(0)} ({s.count})
                </span>
              </div>
            );
          })}
          {series.length > 14 && (
            <p className="text-xs text-gray-600 text-center pt-1">Showing last 14 periods</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Top routes ──────────────────────────────────────────────────────────── */

function TopRoutes({ data }: { data: AnalyticsResult }) {
  const routes = data.topRoutes;
  const maxCount = Math.max(...routes.map((r) => r.count), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Top Routes</h3>
      {routes.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No data for this period.</p>
      ) : (
        <div className="space-y-3">
          {routes.map((r, i) => {
            const bar = Math.round((r.count / maxCount) * 100);
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">
                    {r.origin} <span className="text-gray-600">→</span> {r.destination}
                  </span>
                  <span className="text-gray-500">{r.count} shipments</span>
                </div>
                <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${bar}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Status breakdown ────────────────────────────────────────────────────── */

function StatusBreakdown({ data }: { data: AnalyticsResult }) {
  const items = data.shipments.byStatus.filter((s) => s.count > 0);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">By Status</h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No data for this period.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((s) => (
            <div key={s.status} className="flex items-center gap-3 text-xs">
              <span className="text-gray-400 w-36 flex-shrink-0">
                {s.status.replace(/_/g, " ")}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="text-gray-500 w-16 text-right">
                {s.count} ({s.pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Method breakdown ────────────────────────────────────────────────────── */

function MethodBreakdown({ data }: { data: AnalyticsResult }) {
  const items = data.shipments.byMethod.filter((m) => m.count > 0);
  const maxCount = Math.max(...items.map((m) => m.count), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">By Shipping Method</h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">No data for this period.</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const bar = Math.round((m.count / maxCount) * 100);
            return (
              <div key={m.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{m.method}</span>
                  <span className="text-gray-500">
                    {m.count} · ${m.revenue.toFixed(0)}
                  </span>
                </div>
                <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-yellow-500 rounded-full"
                    style={{ width: `${bar}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 h-48 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
