import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Origin of the API service (FastAPI Cloud). The browser only ever calls the
// same-origin `/api/*`, which is proxied there — so the Cloudflare Access
// cookie/JWT reaches the API and there is no CORS. NEXT_PUBLIC_API_URL is the
// previous name for the same value, accepted so existing build env keeps working.
const apiOrigin = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them.
  transpilePackages: ["@qtscout/types"],
  async rewrites() {
    if (!apiOrigin) {
      throw new Error("API_ORIGIN is not set (e.g. http://localhost:3001 or the API service URL)");
    }
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
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
