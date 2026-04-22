import { Worker } from "bullmq";
import { createNotificationWorker } from "@/modules/notifications/jobs/notification.worker";
import { createTrackingEventWorker } from "@/modules/notifications/jobs/tracking-event.worker";
import { logger } from "@/lib/logger";

let workers: Worker[] = [];

export function startWorkers(): void {
  if (workers.length > 0) {
    logger.warn("Workers already started", "Workers");
    return;
  }

  try {
    workers = [
      createNotificationWorker(),
      createTrackingEventWorker(),
    ];
    logger.info(`Started ${workers.length} background workers`, "Workers");
  } catch (err) {
    // Workers failing to start (e.g. Redis offline) must not crash the HTTP server.
    // They will be retried automatically via the Redis retryStrategy once Redis comes online.
    logger.warn(
      "Workers failed to start — will retry when Redis becomes available",
      "Workers",
      err,
    );
  }
}

export async function stopWorkers(): Promise<void> {
  if (workers.length === 0) return;
  await Promise.all(workers.map((w) => w.close()));
  workers = [];
  logger.info("All workers stopped", "Workers");
}
