import { Queue, ConnectionOptions } from "bullmq";
import { env } from "@/config/env";
import { QUEUE_NAMES } from "@/config/constants";
import { logger } from "@/lib/logger";

// ─── BullMQ connection options ────────────────────────────────────────────
// Pass options (not an IORedis instance) so BullMQ fully manages the lifecycle.
// maxRetriesPerRequest must be null for BullMQ workers.

function parsedRedisUrl(): ConnectionOptions {
  try {
    const url = new URL(env.REDIS_URL);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      db: url.pathname ? Number(url.pathname.slice(1)) || 0 : 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    };
  } catch {
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    };
  }
}

export const bullMqConnection = parsedRedisUrl();

// ─── Queue instances ──────────────────────────────────────────────────────

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const trackingEventQueue = new Queue(QUEUE_NAMES.TRACKING_EVENTS, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

export const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, {
  connection: bullMqConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

// ─── Job type definitions ─────────────────────────────────────────────────

export interface NotificationJobData {
  type: "email" | "webhook";
  recipient: string;
  subject?: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface TrackingEventJobData {
  shipmentId: string;
  trackingNumber: string;
  status: string;
  location?: string;
  description?: string;
}

// ─── Queue health check ───────────────────────────────────────────────────

export async function getQueueStats() {
  const [notifCounts, trackingCounts] = await Promise.all([
    notificationQueue.getJobCounts(),
    trackingEventQueue.getJobCounts(),
  ]);
  return { notifications: notifCounts, tracking: trackingCounts };
}

// Suppress unhandled error events on queue instances when Redis is offline
[notificationQueue, trackingEventQueue, analyticsQueue].forEach((q) => {
  q.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
      logger.error(`Queue error [${q.name}]`, "Queue", err);
    }
  });
});

logger.info("Queue system initialized", "Queue");
