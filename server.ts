/**
 * Custom Next.js server with WebSocket support.
 *
 * Architecture:
 *   HTTP:  All requests handled by Next.js as normal
 *   /ws:   Upgrade → WebSocketServer → WsManager
 *   Redis: Subscriber listens on "tracking:updates" channel,
 *          routes payloads to WsManager.broadcast()
 */

import "reflect-metadata";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import { wsManager } from "./src/lib/realtime/ws-manager";
import { startSubscriber } from "./src/lib/realtime/publisher";
import { startWorkers, stopWorkers } from "./src/lib/workers";
import { logger } from "./src/lib/logger";
import type { WsMessage } from "./src/lib/realtime/ws-manager";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

// ─── Global rejection guard ───────────────────────────────────────────────
// BullMQ / ioredis emit unhandled rejections when Redis is offline at startup.
// We catch them here so the HTTP server stays running until Redis comes back.
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection is closed") ||
    msg.includes("Redis connection")
  ) {
    logger.warn(`Redis not available — will retry: ${msg}`, "Server");
  } else {
    logger.error("Unhandled rejection", "Server", reason);
  }
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl).catch((err) => {
      logger.error("Next.js request handler error", "Server", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    });
  });

  // ─── WebSocket server ────────────────────────────────────────────────────

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, req) => {
    const ip = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown";
    logger.info(`WS connected from ${ip}`, "WsServer");

    // Send welcome
    ws.send(JSON.stringify({ type: "connected", message: "Connected to Logtics realtime" }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleClientMessage(ws, msg);
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      wsManager.remove(ws);
    });

    ws.on("error", (err) => {
      logger.error("WS client error", "WsServer", err);
      wsManager.remove(ws);
    });
  });

  // Only upgrade requests to /ws
  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "/");
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // ─── Redis pub/sub subscriber ─────────────────────────────────────────────

  startSubscriber(({ trackingNumber, event }) => {
    wsManager.broadcast(trackingNumber, event);
  });

  // ─── BullMQ background workers ────────────────────────────────────────────

  startWorkers();

  // ─── Graceful shutdown ────────────────────────────────────────────────────

  async function shutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`, "Server");
    await stopWorkers();
    httpServer.close(() => {
      logger.info("Server closed", "Server");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ─── Start ───────────────────────────────────────────────────────────────

  httpServer.listen(port, hostname, () => {
    logger.info(`Server ready on http://${hostname}:${port}`, "Server");
    logger.info(`WebSocket ready on ws://${hostname}:${port}/ws`, "Server");
  });
});

// ─── Client message handler ──────────────────────────────────────────────

function handleClientMessage(ws: WebSocket, msg: WsMessage) {
  switch (msg.type) {
    case "subscribe":
      if (msg.trackingNumber) {
        wsManager.subscribe(msg.trackingNumber, ws);
        ws.send(
          JSON.stringify({
            type: "subscribed",
            trackingNumber: msg.trackingNumber.toUpperCase(),
          }),
        );
      }
      break;

    case "unsubscribe":
      if (msg.trackingNumber) {
        wsManager.unsubscribe(msg.trackingNumber, ws);
        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            trackingNumber: msg.trackingNumber.toUpperCase(),
          }),
        );
      }
      break;

    case "ping":
      ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      break;

    default:
      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${msg.type}` }));
  }
}
