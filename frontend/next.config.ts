import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // beforeFiles rewrites are checked before pages/public files and after
      // Route Handlers, ensuring local API routes take priority.
      beforeFiles: [
        {
          source: "/api/:path*",
          has: [
            {
              type: "header",
              key: "x-rewrite-to-strapi",
            },
          ],
          destination: "http://localhost:1337/api/:path*",
        },
      ],
      afterFiles: [],
      // fallback rewrites are checked after both pages/public files AND
      // Route Handlers. If a local Route Handler exists (e.g. /api/admin/*,
      // /api/chat), it will be served by Next.js. Otherwise the request
      // falls through to Strapi.
      fallback: [
        {
          source: "/api/:path*",
          destination: "http://localhost:1337/api/:path*",
        },
      ],
    };
  },

  images: {
    remotePatterns: [
      {
        // Cloudflare R2 bucket
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        // R2 public domain
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        // Promidata images
        protocol: "https",
        hostname: "promi-dl.de",
      },
      {
        // Promidata S3
        protocol: "https",
        hostname: "promidatabase.s3.eu-central-1.amazonaws.com",
      },
      {
        // Local Strapi uploads
        protocol: "http",
        hostname: "localhost",
        port: "1337",
      },
    ],
  },
};

export default nextConfig;
