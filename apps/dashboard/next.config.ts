import type { NextConfig } from "next";

/**
 * Next.js configuration for the Badger dashboard.
 *
 * The dashboard talks to the tunnel server only over public HTTP and WebSocket
 * APIs. It never imports server internals. Shared protocol types come from
 * `@hridhin-k/badger-shared`, which Next transpiles from the monorepo workspace.
 */
const nextConfig: NextConfig = {
  transpilePackages: ["@hridhin-k/badger-shared"],
};

export default nextConfig;
