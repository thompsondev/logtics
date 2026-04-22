"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ShipmentStatus } from "@/types";
import { WS_EVENTS } from "@/config/constants";
import type { TrackingResult, TimelineEntry } from "@/modules/tracking/services/tracking.service";

export type { TrackingResult };

/* ── Static maps ─────────────────────────────────────────────────────────── */

const STATUS_ICON: Record<ShipmentStatus, string> = {
  [ShipmentStatus.CREATED]: "📋",
  [ShipmentStatus.PICKED_UP]: "🤝",
  [ShipmentStatus.IN_TRANSIT]: "🚚",
  [ShipmentStatus.ARRIVED_AT_HUB]: "🏭",
  [ShipmentStatus.OUT_FOR_DELIVERY]: "🛵",
  [ShipmentStatus.DELIVERED]: "✅",
  [ShipmentStatus.FAILED_DELIVERY]: "⚠️",
  [ShipmentStatus.RETURNED]: "↩️",
};

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  [ShipmentStatus.CREATED]: "Order Created",
  [ShipmentStatus.PICKED_UP]: "Picked Up",
  [ShipmentStatus.IN_TRANSIT]: "In Transit",
  [ShipmentStatus.ARRIVED_AT_HUB]: "At Hub",
  [ShipmentStatus.OUT_FOR_DELIVERY]: "Out for Delivery",
  [ShipmentStatus.DELIVERED]: "Delivered",
  [ShipmentStatus.FAILED_DELIVERY]: "Delivery Failed",
  [ShipmentStatus.RETURNED]: "Returned",
};

const STATUS_STEPS: ShipmentStatus[] = [
  ShipmentStatus.CREATED,
  ShipmentStatus.PICKED_UP,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.ARRIVED_AT_HUB,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
];

const STATUS_COLOR: Partial<Record<ShipmentStatus, string>> = {
  [ShipmentStatus.DELIVERED]: "text-green-400 bg-green-400/10 border-green-400/20",
  [ShipmentStatus.FAILED_DELIVERY]: "text-red-400 bg-red-400/10 border-red-400/20",
  [ShipmentStatus.RETURNED]: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

function getBadgeColor(status: ShipmentStatus) {
  return STATUS_COLOR[status] ?? "text-blue-400 bg-blue-400/10 border-blue-400/20";
}

function getStepState(step: ShipmentStatus, current: ShipmentStatus) {
  const ci = STATUS_STEPS.indexOf(current);
  const si = STATUS_STEPS.indexOf(step);
  if (ci === -1) return "pending";
  if (si < ci) return "done";
  if (si === ci) return "active";
  return "pending";
}

/* ── WS connection status ────────────────────────────────────────────────── */

type WsState = "connecting" | "live" | "offline";

interface WsMsg {
  type: string;
  trackingNumber?: string;
  data?: unknown;
  message?: string;
}

/* ── Component ───────────────────────────────────────────────────────────── */

interface Props {
  initialData: TrackingResult | null;
  trackingNumber: string;
}

export function LiveTracker({ initialData, trackingNumber }: Props) {
  const [data, setData] = useState<TrackingResult | null>(initialData);
  const [wsState, setWsState] = useState<WsState>("connecting");
  const [justUpdated, setJustUpdated] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Re-fetch fresh data from API when WS signals an update */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracking/${trackingNumber}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data as TrackingResult);
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3000);
      }
    } catch {
      // silent — stale data is still shown
    }
  }, [trackingNumber]);

  /* WebSocket lifecycle */
  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      wsRef.current = ws;
      setWsState("connecting");

      ws.onopen = () => {
        if (destroyed) { ws.close(); return; }
        setWsState("live");
        ws.send(JSON.stringify({ type: "subscribe", trackingNumber }));
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as WsMsg;
          if (
            msg.type === WS_EVENTS.TRACKING_UPDATE &&
            msg.trackingNumber?.toUpperCase() === trackingNumber.toUpperCase()
          ) {
            refresh();
          }
        } catch {
          // malformed message — ignore
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        setWsState("offline");
        // Reconnect after 5 s
        retryRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [trackingNumber, refresh]);

  if (!data) return <NotFound trackingNumber={trackingNumber} />;

  return <TrackingView data={data} wsState={wsState} justUpdated={justUpdated} />;
}

/* ── Not-found ───────────────────────────────────────────────────────────── */

function NotFound({ trackingNumber }: { trackingNumber: string }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-4">📦</div>
      <h1 className="text-2xl font-bold mb-2">Shipment not found</h1>
      <p className="text-gray-400 mb-2">No shipment found for tracking number:</p>
      <p className="text-blue-400 font-mono text-lg mb-8">{trackingNumber.toUpperCase()}</p>
      <a
        href="/track"
        className="bg-blue-600 hover:bg-blue-500 transition-colors px-6 py-3 rounded-xl font-medium text-sm"
      >
        Try again
      </a>
    </div>
  );
}

/* ── Main tracking view ──────────────────────────────────────────────────── */

function TrackingView({
  data,
  wsState,
  justUpdated,
}: {
  data: TrackingResult;
  wsState: WsState;
  justUpdated: boolean;
}) {
  const isTerminal =
    data.status === ShipmentStatus.DELIVERED || data.status === ShipmentStatus.RETURNED;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Tracking Number</p>
            <p className="font-mono text-xl font-bold text-white">{data.trackingNumber}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live indicator */}
            <LiveBadge state={wsState} justUpdated={justUpdated} />
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getBadgeColor(data.status)}`}
            >
              {STATUS_ICON[data.status]} {STATUS_LABEL[data.status]}
            </span>
          </div>
        </div>

        {/* Route */}
        <div className="flex items-center gap-3 mt-5 pt-5 border-t border-gray-800">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">From</p>
            <p className="font-medium truncate">{data.origin.city}</p>
            <p className="text-xs text-gray-500">{data.origin.country}</p>
          </div>
          <div className="text-gray-600 text-xl flex-shrink-0">→</div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-xs text-gray-500 mb-0.5">To</p>
            <p className="font-medium truncate">{data.destination.city}</p>
            <p className="text-xs text-gray-500">{data.destination.country}</p>
          </div>
        </div>

        {/* ETA / delivery */}
        {data.actualDelivery ? (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">Delivered on</p>
            <p className="font-semibold text-green-400">
              {new Date(data.actualDelivery).toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
        ) : data.estimatedDelivery && !isTerminal ? (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">Estimated delivery</p>
            <p className="font-semibold text-blue-300">
              {new Date(data.estimatedDelivery).toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          </div>
        ) : null}
      </div>

      {/* Progress stepper */}
      {!isTerminal && STATUS_STEPS.includes(data.status) && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
            Delivery Progress
          </h2>
          <div className="flex items-center">
            {STATUS_STEPS.map((step, i) => {
              const state = getStepState(step, data.status);
              return (
                <div key={step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all
                        ${state === "done" ? "bg-blue-600 text-white" : ""}
                        ${state === "active" ? "bg-blue-500 text-white ring-4 ring-blue-500/20" : ""}
                        ${state === "pending" ? "bg-gray-800 text-gray-600" : ""}
                      `}
                    >
                      {state === "done" ? "✓" : STATUS_ICON[step]}
                    </div>
                    <span
                      className={`text-[10px] text-center leading-tight max-w-[60px]
                        ${state === "active" ? "text-blue-400 font-semibold" : "text-gray-600"}
                      `}
                    >
                      {STATUS_LABEL[step]}
                    </span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mb-5 mx-1
                        ${STATUS_STEPS.indexOf(data.status) > i ? "bg-blue-600" : "bg-gray-800"}
                      `}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">
          Shipment History
        </h2>
        <TimelineList events={[...data.timeline].reverse()} />
      </div>

      {/* Package details */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Package Details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoItem label="Weight" value={`${data.weightKg} kg`} />
          <InfoItem
            label="Method"
            value={data.shippingMethod.charAt(0) + data.shippingMethod.slice(1).toLowerCase()}
          />
          <InfoItem label="Fragile" value={data.isFragile ? "Yes" : "No"} />
          <InfoItem label="Signature" value={data.requiresSignature ? "Required" : "Not required"} />
        </div>
      </div>
    </div>
  );
}

/* ── Live badge ──────────────────────────────────────────────────────────── */

function LiveBadge({ state, justUpdated }: { state: WsState; justUpdated: boolean }) {
  if (justUpdated) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
        Updated
      </span>
    );
  }
  if (state === "live") {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Live
      </span>
    );
  }
  if (state === "offline") {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-500 border border-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        Offline
      </span>
    );
  }
  return null; // "connecting" — show nothing until state is known
}

/* ── Timeline ────────────────────────────────────────────────────────────── */

function TimelineList({ events }: { events: TimelineEntry[] }) {
  if (!events.length) {
    return <p className="text-gray-500 text-sm">No events yet.</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-3.5 top-4 bottom-4 w-px bg-gray-800" />
      <div className="space-y-6">
        {events.map((ev) => (
          <div key={ev.id} className="flex gap-4 relative">
            <div
              className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs z-10
                ${ev.isLatest ? "bg-blue-600 ring-4 ring-blue-500/20" : "bg-gray-800"}
              `}
            >
              {STATUS_ICON[ev.status] ?? "●"}
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <p className={`font-semibold text-sm ${ev.isLatest ? "text-white" : "text-gray-300"}`}>
                {STATUS_LABEL[ev.status] ?? ev.status}
              </p>
              <p className="text-gray-400 text-sm mt-0.5">{ev.description}</p>
              {ev.location && (
                <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                  <span>📍</span> {ev.location}
                </p>
              )}
              <p className="text-gray-600 text-xs mt-1">
                {new Date(ev.timestamp).toLocaleString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Info item ───────────────────────────────────────────────────────────── */

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}
