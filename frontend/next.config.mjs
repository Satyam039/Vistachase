import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  (process.env.RENDER ? 'https://vistachase-backend.onrender.com' : 'http://localhost:4000')
).replace(/\/$/, '');

// Optional media CDN (see src/lib/media.ts): background clips and their posters stream from it.
// Images stay local on purpose: they are in public/media, which Next serves before any rewrite, and
// next/image resizes them per screen. Read at build time; must be an https URL (plain http only for
// localhost testing), so a typo fails the build instead of breaking media.
const MEDIA_CDN_URL = (process.env.NEXT_PUBLIC_MEDIA_CDN_URL || '').trim().replace(/\/+$/, '');
if (MEDIA_CDN_URL && !/^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)(\/\S*)?$/.test(MEDIA_CDN_URL)) {
  throw new Error(`NEXT_PUBLIC_MEDIA_CDN_URL must be an https URL, got "${MEDIA_CDN_URL}"`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // frontend/ is a standalone app; don't let Next infer a parent folder as the workspace root
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
