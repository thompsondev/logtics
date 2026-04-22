import { WebSocket } from "ws";
import { logger } from "@/lib/logger";

export interface WsMessage {
  type: string;
  trackingNumber?: string;
  data?: unknown;
  message?: string;
}

/**
 * In-memory registry of WebSocket connections keyed by trackingNumber.
 * One client can subscribe to multiple tracking numbers.
 * Multiple clients can watch the same tracking number.
 */
export class WsManager {
  private readonly subscriptions = new Map<string, Set<WebSocket>>();
  private readonly clientSubs = new Map<WebSocket, Set<string>>();

  subscribe(trackingNumber: string, ws: WebSocket) {
    const key = trackingNumber.toUpperCase();

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }
    this.subscriptions.get(key)!.add(ws);

    if (!this.clientSubs.has(ws)) {
      this.clientSubs.set(ws, new Set());
    }
    this.clientSubs.get(ws)!.add(key);

    logger.debug(`Client subscribed to ${key}`, "WsManager");
  }

  unsubscribe(trackingNumber: string, ws: WebSocket) {
    const key = trackingNumber.toUpperCase();
    this.subscriptions.get(key)?.delete(ws);
    this.clientSubs.get(ws)?.delete(key);
    logger.debug(`Client unsubscribed from ${key}`, "WsManager");
  }

  /** Remove all subscriptions for a disconnected client */
  remove(ws: WebSocket) {
    const keys = this.clientSubs.get(ws);
    if (keys) {
      for (const key of keys) {
        this.subscriptions.get(key)?.delete(ws);
        if (this.subscriptions.get(key)?.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    }
    this.clientSubs.delete(ws);
    logger.debug("Client disconnected, subscriptions cleaned up", "WsManager");
  }

  /** Broadcast a message to all clients watching a tracking number */
  broadcast(trackingNumber: string, message: WsMessage) {
    const key = trackingNumber.toUpperCase();
    const clients = this.subscriptions.get(key);
    if (!clients || clients.size === 0) return;

    const payload = JSON.stringify(message);
    let sent = 0;

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    }

    logger.debug(`Broadcast to ${sent}/${clients.size} clients on ${key}`, "WsManager");
  }

  get connectionCount() {
    return this.clientSubs.size;
  }

  get subscriptionCount() {
    return this.subscriptions.size;
  }
}

// Singleton shared within the server process
export const wsManager = new WsManager();
