import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Existing api/ directory serves as Vercel serverless functions alongside Next.js
  // Vercel handles both automatically in production. In local Next dev, proxy to
  // the Express API server that stays on port 3000.
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
