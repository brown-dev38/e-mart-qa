import type { NextConfig } from "next";

// Leave room for multipart fields around the application's 20 MiB file limit.
// Proxy must buffer the same complete body that Server Actions accept.
const uploadRequestLimit = "25mb";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    proxyClientMaxBodySize: uploadRequestLimit,
    serverActions: {
      bodySizeLimit: uploadRequestLimit,
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["@prisma/client", "bcrypt", "mariadb"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
