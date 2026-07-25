import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them.
  transpilePackages: ["@qtscout/types"],
};

// Makes Cloudflare bindings (e.g. the Flagship FLAGS binding) available to
// getCloudflareContext() under `next dev`, not just `wrangler dev`.
initOpenNextCloudflareForDev();

export default nextConfig;
