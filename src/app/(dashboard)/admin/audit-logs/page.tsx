"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { Pagination } from "@/components/ui/pagination";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditPage {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ── Fetch ───────────────────────────────────────────────────────────────── */

async function fetchAuditLogs(params: Record<string, string>): Promise<AuditPage> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/admin/audit-logs?${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as AuditPage;
}

/* ── Action color coding ─────────────────────────────────────────────────── */

function getActionStyle(action: string): string {
  if (action.includes("login")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  if (action.includes("created")) return "bg-green-500/10 text-green-400 border-green-500/20";
  if (action.includes("updated") || action.includes("changed"))
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  if (action.includes("deleted") || action.includes("failed"))
    return "bg-red-500/10 text-red-400 border-red-500/20";
  return "bg-gray-800 text-gray-400 border-gray-700";
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = {
    page: String(page),
    pageSize: "25",
    ...(actionFilter.trim() && { action: actionFilter.trim() }),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => fetchAuditLogs(params),
  });

  function handleActionChange(e: React.ChangeEvent<HTMLInputElement>) {
    setActionFilter(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Header title="Audit Logs" subtitle="Full history of privileged actions" />

      {/* Filter */}
      <div className="flex gap-3">
        <input
          type="text"
          value={actionFilter}
          onChange={handleActionChange}
          placeholder="Filter by action (e.g. shipment.status_changed)"
          className="flex-1 max-w-sm bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
        />
        {data && (
          <span className="self-center text-xs text-gray-600">
            {data.total.toLocaleString()} records
          </span>
        )}
      </div>

      {/* Table card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <LogSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load audit logs.</div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-gray-500 text-sm">No audit logs found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    {["Time", "Action", "Resource", "User", "IP", ""].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {data.data.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="hover:bg-gray-800/40 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getActionStyle(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {log.resourceType ? (
                            <>
                              <span>{log.resourceType}</span>
                              {log.resourceId && (
                                <span className="text-gray-600 ml-1 font-mono">
                                  {log.resourceId.slice(0, 8)}…
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                          {log.userId ? log.userId.slice(0, 8) + "…" : <span className="text-gray-700">system</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {log.ipAddress ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {log.metadata ? (
                            <span className="text-blue-500/60 hover:text-blue-400 transition-colors">
                              {expandedId === log.id ? "▲" : "▼"}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                      {expandedId === log.id && log.metadata && (
                        <tr key={`${log.id}-detail`} className="bg-gray-800/30">
                          <td colSpan={6} className="px-4 py-3">
                            <pre className="text-xs text-gray-400 bg-gray-900 rounded-lg p-3 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
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
    </div>
  );
}

function LogSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-800/50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
