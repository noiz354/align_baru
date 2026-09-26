/**
 * PHASE 0 shell — not a working configuration.
 * Turbopack is the default bundler in Next.js 16 (ADR-0002).
 * The service worker (Serwist) is deliberately NOT configured: it arrives in VS-16 (T-OFF-002).
 * Scheduled jobs are NOT configured here: pg-boss runs in the worker entrypoint (ADR-0018).
 */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Cache Components: opt-in only, and only after an ADR. Left disabled on purpose.
  },
  async headers() {
    return [
      {
        // defence-in-depth headers for the operator surface (filled in at VS-0/T-FOUND-001)
        source: "/(.*)",
        headers: []
      }
    ];
  }
};

export default nextConfig;
