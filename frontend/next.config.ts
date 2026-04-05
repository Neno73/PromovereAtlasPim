import type { NextConfig } from "next";

// Where to proxy /api/* requests that don't have a local Route Handler.
// Read at build time and serialized into the server bundle — must therefore
// be passed as a Docker build arg in production (see frontend/Dockerfile).
// Defaults to the local Strapi dev server for `npm run dev`.
const STRAPI_PROXY_URL =
  process.env.STRAPI_PROXY_URL || "http://localhost:1337";

const nextConfig: NextConfig = {
  // Produce a self-contained production bundle at .next/standalone so the
  // Docker image can run `node server.js` without the full node_modules tree.
  output: "standalone",

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
          destination: `${STRAPI_PROXY_URL}/api/:path*`,
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
          destination: `${STRAPI_PROXY_URL}/api/:path*`,
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
