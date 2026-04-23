import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// In production derive allowed origins from APP_URL; in dev use localhost.
const allowedOrigins = isProd
  ? (process.env.APP_URL ? [new URL(process.env.APP_URL).host] : [])
  : ["localhost:3000"];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins },
  },
  // Packages that must run in Node.js runtime (not edge)
  serverExternalPackages: ["typeorm", "pg", "ioredis", "bullmq", "reflect-metadata"],
};

export default nextConfig;
