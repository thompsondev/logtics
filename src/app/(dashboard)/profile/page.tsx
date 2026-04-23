"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/dashboard/header";
import { AvatarUpload } from "@/components/profile/avatar-upload";

interface Me {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new Error("Failed to load profile");
  const json = await res.json();
  return json.data;
}

async function updateProfile(body: Partial<Pick<Me, "firstName" | "lastName" | "phone">>) {
  const res = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error ?? "Failed to update profile");
  }
  return res.json();
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Populate form once loaded
  const [initialised, setInitialised] = useState(false);
  if (me && !initialised) {
    setFirstName(me.firstName);
    setLastName(me.lastName);
    setPhone(me.phone ?? "");
    setInitialised(true);
  }

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      setSaveMsg("Saved ✓");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setTimeout(() => setSaveMsg(null), 3000);
    },
    onError: (err: Error) => {
      setSaveMsg(err.message);
    },
  });

  if (isLoading || !me) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="My Profile" />
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="My Profile" />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* ── Avatar ──────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-8 flex flex-col items-center gap-2">
          <AvatarUpload
            currentUrl={me.avatarUrl}
            displayName={`${me.firstName} ${me.lastName}`}
          />
          <p className="text-lg font-semibold text-gray-900 mt-2">
            {me.firstName} {me.lastName}
          </p>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
            {me.role}
          </span>
        </section>

        {/* ── Profile form ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Personal Information</h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ firstName, lastName, phone: phone || null });
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                value={me.email}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                           bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                           hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {mutation.isPending ? "Saving…" : "Save changes"}
              </button>
              {saveMsg && (
                <span className={`text-sm ${saveMsg === "Saved ✓" ? "text-green-600" : "text-red-500"}`}>
                  {saveMsg}
                </span>
              )}
            </div>
          </form>
        </section>

        {/* ── Account info ──────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium text-gray-900">
                {new Date(me.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">User ID</dt>
              <dd className="font-mono text-xs text-gray-400">{me.id}</dd>
            </div>
          </dl>
        </section>

      </main>
    </div>
  );
}
