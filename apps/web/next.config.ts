import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// The browser only ever calls the same-origin `/api/*`. In production the
// Worker entry (worker.ts) hands those to the API Worker over a service binding,
// before Next sees them. Locally (`next dev`) there is no binding, so they are
// proxied to API_ORIGIN (the API under `pywrangler dev` or uvicorn).
const apiOrigin = (process.env.API_ORIGIN ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them.
  transpilePackages: ["@qtscout/types"],
  async rewrites() {
    return apiOrigin ? [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }] : [];
  },
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
