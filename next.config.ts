import path from 'path';
import type { NextConfig } from 'next';
import { resolveDevBranding } from './src/lib/branding-environment.mjs';

const nextConfig: NextConfig = {
  output: 'export',
  // Override .env.local for exports; Cloudflare's project URL is deployment authority.
  env: {
    NEXT_PUBLIC_DEV_BRANDING: String(resolveDevBranding({
      requested: process.env.NEXT_PUBLIC_DEV_BRANDING,
      nodeEnv: process.env.NODE_ENV,
      pagesUrl: process.env.CF_PAGES_URL,
    })),
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;