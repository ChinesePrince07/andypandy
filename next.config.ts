import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  async rewrites() {
    return [
      // Ghost versioned API paths → unversioned
      {
        source: "/ghost/api/:version(v\\d+|canary)/admin/:path*",
        destination: "/ghost/api/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
