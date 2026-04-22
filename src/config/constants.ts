export const APP_NAME = "Logtics";
export const APP_VERSION = "1.0.0";

// Shipment tracking number prefix
export const TRACKING_PREFIX = "LGT";

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Cache TTLs (seconds)
export const CACHE_TTL = {
  TRACKING: 30,
  SHIPMENT_LIST: 60,
  ANALYTICS: 300,
  USER: 120,
} as const;

// Queue names
export const QUEUE_NAMES = {
  NOTIFICATIONS: "notifications",
  TRACKING_EVENTS: "tracking-events",
  ANALYTICS: "analytics",
} as const;

// WebSocket events
export const WS_EVENTS = {
  TRACKING_UPDATE: "tracking:update",
  SHIPMENT_STATUS: "shipment:status",
  CONNECT: "connect",
  DISCONNECT: "disconnect",
} as const;

// Audit log actions
export const AUDIT_ACTIONS = {
  SHIPMENT_CREATED: "shipment.created",
  SHIPMENT_UPDATED: "shipment.updated",
  SHIPMENT_STATUS_CHANGED: "shipment.status_changed",
  USER_LOGIN: "user.login",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
} as const;
