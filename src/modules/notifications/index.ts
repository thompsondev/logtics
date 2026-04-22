export { EmailService, emailService } from "./services/email.service";
export type { EmailPayload } from "./services/email.service";
export { renderShipmentStatusEmail } from "./templates/shipment-status.template";
export type { ShipmentStatusTemplateData } from "./templates/shipment-status.template";
export { createNotificationWorker } from "./jobs/notification.worker";
export { createTrackingEventWorker } from "./jobs/tracking-event.worker";
