import Redis from "ioredis";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { WsMessage } from "./ws-manager";

const CHANNEL = "tracking:updates";

// Dedicated Redis connections for pub/sub
// (pub/sub connections can't be used for regular commands)
let publisher: Redis | null = null;
let subscriber: Redis | null = null;

export function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 3 });
    publisher.on("error", (e) => logger.error("Redis publisher error", "Realtime", e));
  }
  return publisher;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 10_000), // cap at 10s between retries
    });
    subscriber.on("error", (e) => {
      // Only log once per reconnect cycle to avoid flooding
      if ((e as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
        logger.error("Redis subscriber error", "Realtime", e);
      }
    });
  }
  return subscriber;
}

export interface TrackingUpdatePayload {
  trackingNumber: string;
  event: WsMessage;
}

/** Called by ShipmentService after every status change */
export async function publishTrackingUpdate(
  trackingNumber: string,
  event: WsMessage,
): Promise<void> {
  try {
    const pub = getPublisher();
    const payload: TrackingUpdatePayload = { trackingNumber, event };
    await pub.publish(CHANNEL, JSON.stringify(payload));
    logger.debug(`Published tracking update: ${trackingNumber}`, "Realtime");
  } catch (err) {
    // Non-fatal — realtime is best-effort
    logger.error("Failed to publish tracking update", "Realtime", err);
  }
}

/**
 * Called once when the WS server starts.
 * Subscribes to the Redis channel and calls `onMessage` for each update.
 */
export function startSubscriber(
  onMessage: (payload: TrackingUpdatePayload) => void,
): void {
  const sub = getSubscriber();

  sub.subscribe(CHANNEL, (err) => {
    if (err) {
      logger.error("Failed to subscribe to Redis channel", "Realtime", err);
    } else {
      logger.info(`Subscribed to Redis channel: ${CHANNEL}`, "Realtime");
    }
  });

  sub.on("message", (_channel: string, message: string) => {
    try {
      const payload = JSON.parse(message) as TrackingUpdatePayload;
      onMessage(payload);
    } catch (err) {
      logger.error("Failed to parse realtime message", "Realtime", err);
    }
  });
}
