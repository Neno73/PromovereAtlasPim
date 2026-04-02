import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:1337/api/:path*",
      },
    ];
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
