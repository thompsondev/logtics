"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination } from "@/components/ui/pagination";
import { ShipmentStatus, ShippingMethod } from "@/types";
import { UpdateStatusModal } from "./update-status-modal";

interface Shipment {
  id: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippingMethod: ShippingMethod;
  receiver: { name: string; email: string };
  origin: { city: string; country: string };
  destination: { city: string; country: string };
  weightKg: number;
  price: number;
  currency: string;
  createdAt: string;
  estimatedDelivery: string | null;
}

async function fetchShipments(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/shipments?${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as { data: Shipment[]; total: number; page: number; pageSize: number; totalPages: number };
}

const STATUSES = Object.values(ShipmentStatus);

export function ShipmentTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [updating, setUpdating] = useState<Shipment | null>(null);

  const params = {
    page: String(page),
    pageSize: "20",
    ...(search && { search }),
    ...(status && { status }),
    ...(method && { shippingMethod: method }),
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["shipments", params],
    queryFn: () => fetchShipments(params),
  });

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search tracking #, receiver…"
          value={search}
          onChange={handleSearchChange}
          className="flex-1 min-w-[220px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
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
        <select
          value={method}
          onChange={(e) => { setMethod(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All methods</option>
          {Object.values(ShippingMethod).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Table card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load shipments.</div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-gray-500 text-sm">No shipments found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    {["Tracking #", "Status", "Receiver", "Route", "Method", "Weight", "Price", "Created", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {data.data.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-blue-400 text-xs whitespace-nowrap">
                        {s.trackingNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={s.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-medium truncate max-w-[140px]">{s.receiver.name}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[140px]">{s.receiver.email}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                        {s.origin.city} → {s.destination.city}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                          {s.shippingMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {s.weightKg} kg
                      </td>
                      <td className="px-4 py-3 text-white text-xs whitespace-nowrap font-medium">
                        {s.currency} {Number(s.price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/track/${s.trackingNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gray-500 hover:text-blue-400 transition-colors"
                          >
                            Track
                          </a>
                          <button
                            onClick={() => setUpdating(s)}
                            className="text-xs text-gray-500 hover:text-white transition-colors"
                          >
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Update status modal */}
      {updating && (
        <UpdateStatusModal
          shipment={updating}
          onClose={() => setUpdating(null)}
          onSuccess={() => { setUpdating(null); refetch(); }}
        />
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
