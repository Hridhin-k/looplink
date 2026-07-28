import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hridhin-k/badger-shared"],
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
