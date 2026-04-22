import { Worker, Job } from "bullmq";
import { bullMqConnection, TrackingEventJobData } from "@/lib/queue";
import { QUEUE_NAMES } from "@/config/constants";
import { logger } from "@/lib/logger";

async function processTrackingEventJob(job: Job<TrackingEventJobData>): Promise<void> {
  const { shipmentId, trackingNumber, status } = job.data;

  logger.info(
    `Processing tracking event: ${trackingNumber} → ${status}`,
    "TrackingEventWorker",
  );

  // Currently: log for analytics aggregation.
  // In Day 10 this feeds the analytics aggregation pipeline.
  // The cache invalidation is already handled synchronously in ShipmentService
  // to ensure the next tracking request gets fresh data immediately.

  logger.debug(
    `Tracking event processed`,
    "TrackingEventWorker",
    { shipmentId, trackingNumber, status },
  );
}

export function createTrackingEventWorker(): Worker<TrackingEventJobData> {
  const worker = new Worker<TrackingEventJobData>(
    QUEUE_NAMES.TRACKING_EVENTS,
    processTrackingEventJob,
    {
      connection: bullMqConnection,
      concurrency: 10,
    },
  );

  worker.on("completed", (job) => {
    logger.debug(`Tracking event job done: ${job.id}`, "TrackingEventWorker");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `Tracking event job failed: ${job?.id}`,
      "TrackingEventWorker",
      err,
    );
  });

  worker.on("error", (err) => {
    logger.error("Tracking event worker error", "TrackingEventWorker", err);
  });

  logger.info("Tracking event worker started", "TrackingEventWorker");
  return worker;
}
