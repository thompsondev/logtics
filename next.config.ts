import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
  },
  // Packages that must run in Node.js runtime (not edge)
  serverExternalPackages: ["typeorm", "pg", "ioredis", "bullmq", "reflect-metadata"],
};

export default nextConfig;
