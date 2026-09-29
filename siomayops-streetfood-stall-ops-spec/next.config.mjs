// @ts-check

// In the Arena preview sandbox the app is rendered inside an iframe on
// https://*.e2b.app; only relax frame-ancestors when explicitly running in
// development or when ARENA_PREVIEW_FRAME_ANCESTORS is provided.
const frameAncestors = process.env.ARENA_PREVIEW_FRAME_ANCESTORS
  ? `'self' ${process.env.ARENA_PREVIEW_FRAME_ANCESTORS}`
  : process.env.NODE_ENV === "production"
    ? "'none'"
    : "'self' https://*.e2b.app https://*.arena.ai";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  experimental: {
    typedRoutes: false,
    serverActions: {
      allowedOrigins: ["*.e2b.app", "localhost:3000", "127.0.0.1:3000"],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          ...(process.env.NODE_ENV === "production" && !process.env.ARENA_PREVIEW_FRAME_ANCESTORS
            ? [{ key: "X-Frame-Options", value: "DENY" }]
            : []),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors ${frameAncestors}; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
