"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { VehicleStatus } from "@/types";
import { VehicleType } from "@/modules/fleet";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface Vehicle {
  id: string;
  plateNumber: string;
  type: VehicleType;
  model: string | null;
  year: number | null;
  capacityKg: number;
  status: VehicleStatus;
  currentDriverId: string | null;
  notes: string | null;
  createdAt: string;
}

interface FleetSummary {
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
  totalDrivers: number;
  availableDrivers: number;
}

interface FleetResponse {
  data: Vehicle[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: FleetSummary;
}

/* ── Status styling ──────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<VehicleStatus, string> = {
  [VehicleStatus.AVAILABLE]: "bg-green-500/10 text-green-400 border border-green-500/20",
  [VehicleStatus.IN_USE]: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  [VehicleStatus.MAINTENANCE]: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
};

const TYPE_ICON: Record<VehicleType, string> = {
  [VehicleType.VAN]: "🚐",
  [VehicleType.TRUCK]: "🚛",
  [VehicleType.MOTORCYCLE]: "🏍️",
  [VehicleType.CAR]: "🚗",
  [VehicleType.BICYCLE]: "🚲",
};

/* ── Fetch ───────────────────────────────────────────────────────────────── */

async function fetchFleet(page: number): Promise<FleetResponse> {
  const res = await fetch(`/api/fleet?page=${page}&pageSize=20`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as FleetResponse;
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function FleetPage() {
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fleet", page],
    queryFn: () => fetchFleet(page),
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ["fleet"] });
  }

  return (
    <div className="space-y-6">
      <Header
        title="Fleet"
        subtitle="Vehicles and drivers"
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Add Vehicle
          </button>
        }
      />

      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Total", value: data.summary.total, accent: "text-white" },
            { label: "Available", value: data.summary.available, accent: "text-green-400" },
            { label: "In Use", value: data.summary.inUse, accent: "text-blue-400" },
            { label: "Maintenance", value: data.summary.maintenance, accent: "text-yellow-400" },
            { label: "Drivers", value: data.summary.totalDrivers, accent: "text-purple-400" },
            { label: "Avail. Drivers", value: data.summary.availableDrivers, accent: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load fleet.</div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-gray-500 text-sm">No vehicles registered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  {["Vehicle", "Type", "Status", "Capacity", "Driver", "Added", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {data.data.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} onUpdated={refetch} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 rounded-lg disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {showAdd && (
        <AddVehicleModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); refetch(); }}
        />
      )}
    </div>
  );
}

/* ── Vehicle row with inline status update ───────────────────────────────── */

function VehicleRow({ vehicle: v, onUpdated }: { vehicle: Vehicle; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);

  async function changeStatus(status: VehicleStatus) {
    setUpdating(true);
    try {
      await fetch(`/api/fleet/${v.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onUpdated();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <tr className="hover:bg-gray-800/40 transition-colors">
      <td className="px-4 py-3">
        <p className="font-mono text-white text-xs font-medium">{v.plateNumber}</p>
        {v.model && <p className="text-gray-500 text-xs">{v.model}{v.year ? ` · ${v.year}` : ""}</p>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-base">{TYPE_ICON[v.type]}</span>
        <span className="text-xs text-gray-400 ml-2">{v.type}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[v.status]}`}>
          {v.status.replace("_", " ")}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
        {Number(v.capacityKg).toLocaleString()} kg
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {v.currentDriverId ? (
          <span className="font-mono">{v.currentDriverId.slice(0, 8)}…</span>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        {new Date(v.createdAt).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <select
          value={v.status}
          disabled={updating}
          onChange={(e) => changeStatus(e.target.value as VehicleStatus)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
        >
          {Object.values(VehicleStatus).map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

/* ── Add vehicle modal ───────────────────────────────────────────────────── */

function AddVehicleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    plateNumber: "", type: VehicleType.VAN, model: "",
    year: "", capacityKg: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: form.plateNumber.trim(),
          type: form.type,
          model: form.model.trim() || undefined,
          year: form.year ? Number(form.year) : undefined,
          capacityKg: Number(form.capacityKg),
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Add Vehicle</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Plate Number *</label>
              <input value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
                placeholder="ABC-1234" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Type *</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as VehicleType }))}
                className={inputCls}>
                {Object.values(VehicleType).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Model</label>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder="Toyota Hiace" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Year</label>
              <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                placeholder="2022" min="1990" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Capacity (kg) *</label>
            <input type="number" value={form.capacityKg} onChange={(e) => setForm((f) => ({ ...f, capacityKg: e.target.value }))}
              placeholder="1000" min="1" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Any notes…" className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-white transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
