import { NextResponse } from "next/server";
import { wsManager } from "@/lib/realtime/ws-manager";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    realtime: {
      connections: wsManager.connectionCount,
      subscriptions: wsManager.subscriptionCount,
    },
  });
}
