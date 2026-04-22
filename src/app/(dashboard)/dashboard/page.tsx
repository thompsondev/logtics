"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { ShipmentStatus, ShippingMethod } from "@/types";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface Shipment {
  id: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippingMethod: ShippingMethod;
  origin: { city: string; country: string };
  destination: { city: string; country: string };
  weightKg: number;
  price: number;
  currency: string;
  createdAt: string;
  estimatedDelivery: string | null;
}

interface ShipmentPage {
  data: Shipment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ── Fetch ───────────────────────────────────────────────────────────────── */

async function fetchMyShipments(params: Record<string, string>): Promise<ShipmentPage> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/shipments?${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as ShipmentPage;
}

/* ── Page ────────────────────────────────────────────────────────────────── */

const STATUSES = Object.values(ShipmentStatus);

export default function CustomerDashboardPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const params = {
    page: String(page),
    pageSize: "10",
    sortBy: "createdAt",
    sortOrder: "DESC",
    ...(search && { search }),
    ...(status && { status }),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-shipments", params],
    queryFn: () => fetchMyShipments(params),
  });

  /* Stat helpers derived from current page — good enough for the customer view */
  const total = data?.total ?? 0;
  const inTransitCount = data?.data.filter((s) =>
    [ShipmentStatus.IN_TRANSIT, ShipmentStatus.PICKED_UP,
     ShipmentStatus.ARRIVED_AT_HUB, ShipmentStatus.OUT_FOR_DELIVERY].includes(s.status)
  ).length ?? 0;
  const deliveredCount = data?.data.filter(
    (s) => s.status === ShipmentStatus.DELIVERED
  ).length ?? 0;

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <Header title="My Shipments" subtitle="Track and manage your deliveries" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="📦" label="Total" value={total} accent="text-blue-400" />
        <StatCard icon="🚚" label="In Transit" value={inTransitCount} accent="text-yellow-400" sub="on this page" />
        <StatCard icon="✅" label="Delivered" value={deliveredCount} accent="text-green-400" sub="on this page" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search tracking #…"
          className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Shipments list */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <ListSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">
            Failed to load shipments.
          </div>
        ) : !data?.data.length ? (
          <EmptyState filtered={!!(search || status)} />
        ) : (
          <>
            <div className="divide-y divide-gray-800/60">
              {data.data.map((s) => (
                <ShipmentRow key={s.id} shipment={s} />
              ))}
            </div>
            <div className="border-t border-gray-800 px-4">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({
  icon, label, value, accent, sub,
}: {
  icon: string; label: string; value: number; accent: string; sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${accent}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ShipmentRow({ shipment: s }: { shipment: Shipment }) {
  const isTerminal =
    s.status === ShipmentStatus.DELIVERED || s.status === ShipmentStatus.RETURNED;

  return (
    <div className="flex items-center gap-4 px-4 py-4 hover:bg-gray-800/30 transition-colors">
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
        {s.status === ShipmentStatus.DELIVERED ? "✅" :
         s.status === ShipmentStatus.IN_TRANSIT ? "🚚" :
         s.status === ShipmentStatus.OUT_FOR_DELIVERY ? "🛵" : "📦"}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-blue-400 font-medium">{s.trackingNumber}</span>
          <StatusBadge status={s.status} size="sm" />
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {s.origin.city} → {s.destination.city}
          <span className="mx-1.5 text-gray-700">·</span>
          {s.weightKg} kg
          <span className="mx-1.5 text-gray-700">·</span>
          {s.shippingMethod}
        </p>
      </div>

      {/* Right side */}
      <div className="flex-shrink-0 text-right space-y-1">
        <p className="text-sm font-medium text-white">
          {s.currency} {Number(s.price).toFixed(2)}
        </p>
        {!isTerminal && s.estimatedDelivery ? (
          <p className="text-xs text-gray-500">
            ETA {new Date(s.estimatedDelivery).toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            })}
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            {new Date(s.createdAt).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Track link */}
      <a
        href={`/track/${s.trackingNumber}`}
        target="_blank"
        rel="noreferrer"
        className="flex-shrink-0 text-xs text-gray-500 hover:text-blue-400 transition-colors px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg"
      >
        Track →
      </a>
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="py-16 text-center">
      <div className="text-4xl mb-3">📦</div>
      <p className="text-gray-400 font-medium">
        {filtered ? "No shipments match your filters." : "You have no shipments yet."}
      </p>
      {filtered && (
        <p className="text-gray-600 text-sm mt-1">Try adjusting your search or status filter.</p>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-gray-800/60">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="w-10 h-10 rounded-xl bg-gray-800 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-56 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-16 bg-gray-800 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
