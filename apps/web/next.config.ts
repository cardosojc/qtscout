import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them.
  transpilePackages: ["@qtscout/types"],
};

// Makes Cloudflare bindings (e.g. the Flagship FLAGS binding) available to
// getCloudflareContext() under `next dev`, not just `wrangler dev`. Must be
// dev-only: it unconditionally opens a remote wrangler proxy session, which
// needs auth and breaks `next build` in non-interactive CI (no
// CLOUDFLARE_API_TOKEN) even though it happens to work locally when already
// logged into wrangler.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

export default nextConfig;
