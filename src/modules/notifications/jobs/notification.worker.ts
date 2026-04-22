import { Worker, Job } from "bullmq";
import { bullMqConnection, NotificationJobData } from "@/lib/queue";
import { emailService } from "@/modules/notifications/services/email.service";
import { renderShipmentStatusEmail } from "@/modules/notifications/templates/shipment-status.template";
import { QUEUE_NAMES } from "@/config/constants";
import { ShipmentStatus } from "@/types";
import { logger } from "@/lib/logger";
import { env } from "@/config/env";

async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { type, recipient, template, payload } = job.data;

  logger.info(`Processing notification job: ${job.name} → ${recipient}`, "NotificationWorker");

  if (type === "email") {
    await processEmailJob(recipient, template, payload);
  } else if (type === "webhook") {
    await processWebhookJob(job.data);
  } else {
    throw new Error(`Unknown notification type: ${type}`);
  }
}

async function processEmailJob(
  recipient: string,
  template: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!recipient || !recipient.includes("@")) {
    logger.warn(`Skipping email — invalid recipient: ${recipient}`, "NotificationWorker");
    return;
  }

  if (template === "shipment-status") {
    const shipment = payload.shipment as {
      trackingNumber: string;
      status: ShipmentStatus;
      receiver: { name: string };
      origin: { city: string };
      destination: { city: string };
      estimatedDelivery?: Date | null;
    };

    const { subject, html } = renderShipmentStatusEmail({
      trackingNumber: shipment.trackingNumber,
      status: payload.status as ShipmentStatus,
      receiverName: shipment.receiver?.name ?? "Customer",
      originCity: shipment.origin?.city ?? "Unknown",
      destinationCity: shipment.destination?.city ?? "Unknown",
      estimatedDelivery: shipment.estimatedDelivery ?? null,
      location: payload.location as string | undefined,
      appUrl: env.APP_URL,
    });

    await emailService.send({ to: recipient, subject, html });
  } else {
    logger.warn(`Unknown email template: ${template}`, "NotificationWorker");
  }
}

// Webhook stub — full implementation in Day 10
async function processWebhookJob(data: NotificationJobData): Promise<void> {
  logger.info(`Webhook job queued (stub): ${JSON.stringify(data.payload)}`, "NotificationWorker");
  // TODO Day 10: POST to registered webhook URLs with HMAC signature
}

export function createNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: bullMqConnection,
      concurrency: 5,
    },
  );

  worker.on("completed", (job) => {
    logger.info(`Notification job completed: ${job.id}`, "NotificationWorker");
  });

  worker.on("failed", (job, err) => {
    logger.error(
      `Notification job failed: ${job?.id} — ${err.message}`,
      "NotificationWorker",
      err,
    );
  });

  worker.on("error", (err) => {
    logger.error("Notification worker error", "NotificationWorker", err);
  });

  logger.info("Notification worker started", "NotificationWorker");
  return worker;
}
