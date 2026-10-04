import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  (process.env.RENDER ? 'https://vistachase-backend.onrender.com' : 'http://localhost:4000')
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // frontend/ is a standalone app; don't let Next infer a parent folder as the workspace root
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  reactStrictMode: true,
  // No remote image hosts: every image is served by the backend at /media (rewrite below).
  images: {
    remotePatterns: [],
  },
  // Browser requests to /api/* and /media/* are proxied to the Express backend, so client code
  // keeps using relative URLs and the vc_token auth cookie stays first-party.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Every site image lives in the backend (backend/media). next/image requests
      // /media/... as a local path, and this rewrite fetches it from the backend.
      {
        source: '/media/:path*',
        destination: `${BACKEND_URL}/media/:path*`,
      },
      // Browsers still ask for /favicon.ico directly.
      {
        source: '/favicon.ico',
        destination: `${BACKEND_URL}/media/brand/favicon-32.png`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
