/** Security headers implemented for production (T-SEC-002) */
// Frame-embedding is denied in production. In local development only, the deny is
// lifted so the HQ console can be shown inside a sandboxed preview iframe.
const isDev = process.env.NODE_ENV !== "production";
const frameAncestors = isDev ? "" : " frame-ancestors 'none';";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {},
  // Dev-only: allow the sandboxed preview host to load dev assets/HMR (ignored in production builds).
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(isDev ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';${frameAncestors}` },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
