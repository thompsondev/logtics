import { WS_EVENTS } from "@/config/constants";
import { publishTrackingUpdate } from "./publisher";

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export { WsManager, wsManager } from "./ws-manager";
export { publishTrackingUpdate, startSubscriber } from "./publisher";
export type { WsMessage } from "./ws-manager";
export type { TrackingUpdatePayload } from "./publisher";

/**
 * Broadcast a tracking status update to all subscribed clients.
 * Called by ShipmentService after every status change.
 * Publishes to Redis → WS server picks it up and forwards to connected clients.
 */
export async function broadcastTrackingUpdate(
  trackingNumber: string,
  data: unknown,
): Promise<void> {
  await publishTrackingUpdate(trackingNumber, {
    type: WS_EVENTS.TRACKING_UPDATE,
    trackingNumber,
    data,
  });
}
