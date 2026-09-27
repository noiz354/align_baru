/**
 * Next.js configuration - src/../next.config.ts
 *
 * Where this belongs: repository root, next to `package.json` (Next.js 16 reads `next.config.ts`).
 * Specification: ADR-0002 (modular monolith on Next.js App Router), ADR-0020 (container topology),
 *   DEPLOYMENT.md §2 (multi-stage image, standalone output), docs/research/STACK-2026.md.
 *
 * Deliberately absent, each owned by its own task:
 *   - CSP, security headers and frame protection: T-SEC-006. A static CSP header here would break
 *     Next's inline flight scripts, which need a per-request nonce from the proxy layer; faking it
 *     would be worse than leaving it to the task that can do it correctly (AGENTS.md §4.1).
 *   - Rewrite/redirect rules and the public discovery surface: VS-2 (T-EVENT-003 and friends).
 *   - Bundle analyser, image domains, PWA manifest wiring: VS-1/VS-3 tasks.
 *
 * Task ownership: T-ARCH-001 (app shell and build).
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ADR-0020: the web container ships a standalone server, no dev dependencies at runtime.
  output: "standalone",
  reactStrictMode: true,
  // No fingerprint of the framework on every response (SECURITY.md §9: minimise disclosure).
  poweredByHeader: false,
  // `pg` resolves native/optional bindings at runtime and must not be bundled into the server build.
  serverExternalPackages: ["pg"],
  // No `eslint` key: Next 16 dropped it. `npm run lint` (with this project's own rules) is the only
  // lint gate, so the build cannot disagree with it.
  // Type errors still fail the build (default): `npm run typecheck` is the same gate, run earlier.
};

export default nextConfig;
