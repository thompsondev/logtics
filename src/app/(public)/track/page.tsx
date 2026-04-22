"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { APP_NAME } from "@/config/constants";

export default function TrackSearchPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const tn = value.trim().toUpperCase();
    if (!tn) {
      setError("Please enter a tracking number.");
      return;
    }
    router.push(`/track/${tn}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs">
            L
          </div>
          <span className="font-semibold">{APP_NAME}</span>
        </Link>
        <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
          Sign in →
        </Link>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center text-3xl mb-6">
          🔍
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2">Track your shipment</h1>
        <p className="text-gray-400 text-center mb-10 max-w-md">
          Enter your tracking number below to see real-time delivery status and history.
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(""); }}
              placeholder="e.g. LGT-ABC123-XY456789"
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-5 py-3.5 text-white text-sm font-mono outline-none focus:border-blue-500 transition-colors placeholder-gray-600"
            />
            <button
              type="submit"
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors whitespace-nowrap"
            >
              Track
            </button>
          </div>
          {error && (
            <p className="text-red-400 text-xs mt-2 px-1">{error}</p>
          )}
        </form>

        {/* Feature hints */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full">
          {[
            { icon: "⚡", title: "Real-time updates", desc: "Status refreshes live via WebSocket" },
            { icon: "🗺️", title: "Full history", desc: "Every checkpoint logged with location" },
            { icon: "📬", title: "ETA included", desc: "Estimated delivery shown when available" },
          ].map((f) => (
            <div key={f.title} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="text-sm font-medium text-white">{f.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-600">
          Have an account?{" "}
          <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
            Sign in
          </Link>{" "}
          to manage your shipments.
        </p>
      </div>
    </div>
  );
}
