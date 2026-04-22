import { ShipmentStatus } from "@/types";
import { APP_NAME } from "@/config/constants";

/** Escape user-supplied strings before embedding them in HTML. */
function esc(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitise a URL: only allow http/https schemes to prevent
 * javascript: or data: URI injection in href/src attributes.
 */
function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "#";
    }
    return url.toString();
  } catch {
    return "#";
  }
}

const STATUS_COPY: Record<
  ShipmentStatus,
  { headline: string; body: string; color: string; emoji: string }
> = {
  [ShipmentStatus.CREATED]: {
    emoji: "📋",
    headline: "Shipment Created",
    body: "Your shipment has been created and is awaiting pickup. You'll receive an update as soon as it's collected.",
    color: "#3b82f6",
  },
  [ShipmentStatus.PICKED_UP]: {
    emoji: "🤝",
    headline: "Package Picked Up",
    body: "Your package has been collected from the sender and is on its way into our network.",
    color: "#8b5cf6",
  },
  [ShipmentStatus.IN_TRANSIT]: {
    emoji: "🚚",
    headline: "Package In Transit",
    body: "Your package is moving through our network and heading to its destination.",
    color: "#f59e0b",
  },
  [ShipmentStatus.ARRIVED_AT_HUB]: {
    emoji: "🏭",
    headline: "Arrived at Distribution Hub",
    body: "Your package has arrived at a distribution hub and will be dispatched for delivery soon.",
    color: "#06b6d4",
  },
  [ShipmentStatus.OUT_FOR_DELIVERY]: {
    emoji: "🛵",
    headline: "Out for Delivery",
    body: "Great news — your package is out for delivery today! Please ensure someone is available to receive it.",
    color: "#10b981",
  },
  [ShipmentStatus.DELIVERED]: {
    emoji: "✅",
    headline: "Delivered Successfully",
    body: "Your package has been delivered. Thank you for choosing Logtics!",
    color: "#22c55e",
  },
  [ShipmentStatus.FAILED_DELIVERY]: {
    emoji: "⚠️",
    headline: "Delivery Attempt Failed",
    body: "We attempted to deliver your package but were unable to complete the delivery. We'll try again or contact you with next steps.",
    color: "#f97316",
  },
  [ShipmentStatus.RETURNED]: {
    emoji: "↩️",
    headline: "Package Returned",
    body: "Your package is being returned to the sender. Please contact us if you have any questions.",
    color: "#6b7280",
  },
};

export interface ShipmentStatusTemplateData {
  trackingNumber: string;
  status: ShipmentStatus;
  receiverName: string;
  originCity: string;
  destinationCity: string;
  estimatedDelivery?: Date | null;
  location?: string;
  appUrl: string;
}

export function renderShipmentStatusEmail(data: ShipmentStatusTemplateData): {
  subject: string;
  html: string;
} {
  const copy = STATUS_COPY[data.status];
  const appUrl = safeUrl(data.appUrl);
  const trackUrl = safeUrl(`${appUrl}/track/${data.trackingNumber}`);

  const etaRow =
    data.estimatedDelivery && data.status !== ShipmentStatus.DELIVERED
      ? `<tr>
           <td style="padding:4px 0;color:#9ca3af;font-size:13px;">Estimated delivery</td>
           <td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right;">
             ${esc(new Date(data.estimatedDelivery).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }))}
           </td>
         </tr>`
      : "";

  const locationRow = data.location
    ? `<tr>
         <td style="padding:4px 0;color:#9ca3af;font-size:13px;">Current location</td>
         <td style="padding:4px 0;font-size:13px;text-align:right;">${esc(data.location)}</td>
       </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${copy.headline}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="display:inline-block;background:#3b82f6;color:#fff;font-weight:700;font-size:16px;padding:8px 16px;border-radius:8px;">
                ${APP_NAME}
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">

              <!-- Status bar -->
              <div style="background:${copy.color};padding:24px 32px;">
                <p style="margin:0;font-size:28px;">${copy.emoji}</p>
                <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:700;">${copy.headline}</h1>
              </div>

              <!-- Body -->
              <div style="padding:32px;">
                <p style="margin:0 0 8px;color:#374151;font-size:15px;">Hi ${esc(data.receiverName)},</p>
                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">${copy.body}</p>

                <!-- Tracking info table -->
                <table width="100%" cellpadding="0" cellspacing="0"
                  style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:24px;">
                  <tr>
                    <td style="padding:4px 0;color:#9ca3af;font-size:13px;">Tracking number</td>
                    <td style="padding:4px 0;font-size:13px;font-weight:700;text-align:right;font-family:monospace;color:#111827;">
                      ${esc(data.trackingNumber)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#9ca3af;font-size:13px;">Route</td>
                    <td style="padding:4px 0;font-size:13px;text-align:right;">${esc(data.originCity)} → ${esc(data.destinationCity)}</td>
                  </tr>
                  ${etaRow}
                  ${locationRow}
                </table>

                <!-- CTA -->
                <div style="text-align:center;margin-bottom:24px;">
                  <a href="${trackUrl}"
                    style="display:inline-block;background:#3b82f6;color:#fff;font-weight:600;font-size:14px;
                           padding:12px 28px;border-radius:10px;text-decoration:none;"
                    rel="noopener noreferrer">
                    Track Your Shipment →
                  </a>
                </div>

                <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                  You're receiving this because a shipment is being delivered to you.<br/>
                  If you have questions, reply to this email or visit
                  <a href="${appUrl}" style="color:#3b82f6;">${esc(APP_NAME)}</a>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `${copy.emoji} ${copy.headline} — ${data.trackingNumber}`,
    html,
  };
}
