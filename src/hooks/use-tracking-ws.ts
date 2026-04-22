"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

export interface TrackingUpdate {
  status: string;
  shipmentId: string;
  trackingNumber: string;
  updatedAt: string;
}

interface UseTrackingWsOptions {
  /** Disable the hook when false — useful for SSR or when no tracking number is available */
  enabled?: boolean;
  onUpdate?: (update: TrackingUpdate) => void;
}

/**
 * Subscribes to realtime tracking updates for a given tracking number via WebSocket.
 *
 * Handles:
 * - Auto-connect on mount
 * - Subscribe/unsubscribe on tracking number change
 * - Exponential backoff reconnect (max 30s)
 * - Heartbeat ping every 30s to keep the connection alive
 */
export function useTrackingWs(
  trackingNumber: string | null,
  opts: UseTrackingWsOptions = {},
) {
  const { enabled = true, onUpdate } = opts;
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<TrackingUpdate | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const retries = useRef(0);
  const unmounted = useRef(false);

  const getWsUrl = useCallback(() => {
    if (typeof window === "undefined") return null;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws`;
  }, []);

  const connect = useCallback(() => {
    if (unmounted.current || !enabled || !trackingNumber) return;

    const url = getWsUrl();
    if (!url) return;

    setWsStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      retries.current = 0;
      setWsStatus("connected");

      // Subscribe to the tracking number
      ws.send(JSON.stringify({ type: "subscribe", trackingNumber }));

      // Heartbeat
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "tracking:update" && msg.data) {
          const update = msg.data as TrackingUpdate;
          setLastUpdate(update);
          onUpdate?.(update);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => setWsStatus("error");

    ws.onclose = () => {
      if (unmounted.current) return;
      setWsStatus("disconnected");
      clearInterval(pingTimer.current ?? undefined);

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
      const delay = Math.min(1000 * 2 ** retries.current, 30_000);
      retries.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [enabled, trackingNumber, getWsUrl, onUpdate]);

  useEffect(() => {
    unmounted.current = false;
    if (!enabled || !trackingNumber) return;

    connect();

    return () => {
      unmounted.current = true;
      clearTimeout(reconnectTimer.current ?? undefined);
      clearInterval(pingTimer.current ?? undefined);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled, trackingNumber]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { wsStatus, lastUpdate, send };
}
