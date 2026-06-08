import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next must transpile them.
  transpilePackages: ["@qtscout/types", "@qtscout/core"],
};

export default nextConfig;
