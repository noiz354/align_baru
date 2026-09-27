import type { NextConfig } from 'next';

/**
 * Next.js 16 application config (ADR-001, T-PLAT-002, T-PLAT-020).
 *
 * - `output: 'standalone'` is what the Docker image ships (DEPLOYMENT.md §3).
 * - Security headers and the CSP nonce are produced in `src/proxy.ts` (T-PLAT-026) —
 *   this file deliberately contains no authorization logic (ADR-001).
 * - `cacheComponents` is left at the Next 16 default; cache tags per dashboard section
 *   are declared by the read model (ARCHITECTURE.md §8, T-DASH-001).
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Node 24 runtime only; no Edge runtime is used anywhere (ADR-001, STACK-2026 §3).
    serverActions: {
      bodySizeLimit: '6mb', // issue photos are ≤5MB each and posted as multipart (SECURITY.md §9)
    },
  },
};

export default nextConfig;
