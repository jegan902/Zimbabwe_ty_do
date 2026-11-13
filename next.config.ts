import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cpus: 1,
  },
  // Native / server-only modules must never be bundled into the client graph.
  serverExternalPackages: ["pino", "pino-pretty"],

  poweredByHeader: false,

  // Supplier product images come from arbitrary third-party hosts, so they are
  // rendered with plain <img>. Only our own assets go through the optimizer.
  images: {
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },

};

export default nextConfig;