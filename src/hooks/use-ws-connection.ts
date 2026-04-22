"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WsStatus } from "./use-tracking-ws";

/**
 * Raw WebSocket connection hook — used by the dashboard to receive
 * any updates pushed from the server without subscribing to a specific
 * tracking number. Handlers are registered dynamically via onMessage.
 */
export function useWsConnection() {
  const [status, setStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, (data: unknown) => void>>(new Map());
  const retries = useRef(0);
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current || typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws`;

    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      retries.current = 0;
      setStatus("connected");
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; data?: unknown };
        handlersRef.current.get(msg.type)?.(msg.data);
      } catch { /* ignore */ }
    };

    ws.onerror = () => setStatus("error");

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus("disconnected");
      const delay = Math.min(1000 * 2 ** retries.current, 30_000);
      retries.current++;
      setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const subscribe = useCallback((trackingNumber: string) => {
    wsRef.current?.send(JSON.stringify({ type: "subscribe", trackingNumber }));
  }, []);

  const unsubscribe = useCallback((trackingNumber: string) => {
    wsRef.current?.send(JSON.stringify({ type: "unsubscribe", trackingNumber }));
  }, []);

  const on = useCallback((eventType: string, handler: (data: unknown) => void) => {
    handlersRef.current.set(eventType, handler);
    return () => handlersRef.current.delete(eventType);
  }, []);

  return { status, subscribe, unsubscribe, on };
}
