"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { Pagination } from "@/components/ui/pagination";
import { UserRole } from "@/types";

/* ── Types ───────────────────────────────────────────────────────────────── */

interface UserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

interface UserPage {
  data: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ── Role styling ────────────────────────────────────────────────────────── */

const ROLE_STYLE: Record<UserRole, string> = {
  [UserRole.ADMIN]: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
  [UserRole.STAFF]: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  [UserRole.CUSTOMER]: "bg-gray-800 text-gray-400 border border-gray-700",
};

/* ── Fetch ───────────────────────────────────────────────────────────────── */

async function fetchUsers(params: Record<string, string>): Promise<UserPage> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/users?${qs}`, { credentials: "include" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data as UserPage;
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const qc = useQueryClient();

  const params = {
    page: String(page),
    pageSize: "20",
    ...(search.trim() && { search: search.trim() }),
    ...(roleFilter && { role: roleFilter }),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", params],
    queryFn: () => fetchUsers(params),
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ["users"] });
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <Header
        title="Users"
        subtitle={data ? `${data.total.toLocaleString()} total` : "Manage platform users"}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search name or email…"
          className="flex-1 min-w-[200px] bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-colors"
        >
          <option value="">All roles</option>
          {Object.values(UserRole).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load users.</div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-gray-500 text-sm">No users found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left">
                    {["User", "Role", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {data.data.map((u) => (
                    <UserRow key={u.id} user={u} onUpdated={refetch} />
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

/* ── User row ────────────────────────────────────────────────────────────── */

function UserRow({ user: u, onUpdated }: { user: UserRecord; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  async function changeRole(role: UserRole) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onUpdated();
    } finally {
      setUpdating(false);
    }
  }

  async function deactivate() {
    setUpdating(true);
    try {
      await fetch(`/api/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      onUpdated();
    } finally {
      setUpdating(false);
      setConfirmDeactivate(false);
    }
  }

  return (
    <tr className="hover:bg-gray-800/40 transition-colors">
      {/* User */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {u.firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {u.firstName} {u.lastName}
            </p>
            <p className="text-gray-500 text-xs truncate">{u.email}</p>
          </div>
        </div>
      </td>
      {/* Role */}
      <td className="px-4 py-3 whitespace-nowrap">
        <select
          value={u.role}
          disabled={updating}
          onChange={(e) => changeRole(e.target.value as UserRole)}
          className={`text-xs px-2 py-0.5 rounded-full border outline-none cursor-pointer transition-colors disabled:opacity-50 ${ROLE_STYLE[u.role]} bg-transparent`}
        >
          {Object.values(UserRole).map((r) => (
            <option key={r} value={r} className="bg-gray-900 text-white">{r}</option>
          ))}
        </select>
      </td>
      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
          {u.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      {/* Joined */}
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        {new Date(u.createdAt).toLocaleDateString()}
      </td>
      {/* Actions */}
      <td className="px-4 py-3 whitespace-nowrap">
        {u.isActive && (
          confirmDeactivate ? (
            <div className="flex items-center gap-2">
              <button
                onClick={deactivate}
                disabled={updating}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDeactivate(false)}
                className="text-xs text-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeactivate(true)}
              disabled={updating}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Deactivate
            </button>
          )
        )}
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-800/50 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}
