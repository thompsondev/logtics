import Link from "next/link";
import { APP_NAME } from "@/config/constants";
import { LiveTracker } from "@/components/tracking/live-tracker";
import type { TrackingResult } from "@/components/tracking/live-tracker";

async function fetchTracking(trackingNumber: string): Promise<TrackingResult | null> {
  try {
    const res = await fetch(
      `${process.env.APP_URL ?? "http://localhost:3000"}/api/tracking/${trackingNumber}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as TrackingResult) : null;
  } catch {
    return null;
  }
}

export default async function PublicTrackingPage({
  params,
}: {
  params: Promise<{ trackingNumber: string }>;
}) {
  const { trackingNumber } = await params;
  const upper = trackingNumber.toUpperCase();
  const initialData = await fetchTracking(upper);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xs">
            L
          </div>
          <span className="font-semibold">{APP_NAME}</span>
        </Link>
        <Link href="/track" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Track another
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* LiveTracker is a client component — hydrates with WS on the browser */}
        <LiveTracker initialData={initialData} trackingNumber={upper} />
      </div>
    </div>
  );
}
