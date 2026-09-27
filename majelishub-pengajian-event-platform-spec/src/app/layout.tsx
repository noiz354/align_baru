/**
 * ROOT LAYOUT - src/app/layout.tsx
 *
 * Where this belongs: `src/app` (Next.js App Router requires exactly one root layout that renders
 * `<html>` and `<body>`; without it `next build` fails outright - T-ARCH-001).
 * Specification: DESIGN.md (principles: CALM, ACCESSIBLE, MOBILE FIRST), ACCESSIBILITY.md §WCAG row
 *   "Operable" (full keyboard operation, visible focus, skip links), ADR-0002, ADR-0027 (PWA-first).
 *
 * What this file deliberately does NOT do:
 *   - No visual design. The design system is VS-1 (docs/design/DESIGN-SYSTEM.md); this layout only wires
 *     the token stylesheet and the non-negotiable accessibility floor. Components read tokens, never
 *     literals (src/app/styles/README.md §1).
 *   - No data fetching, no session lookup, no permission checks. Those belong to routes/Server Actions
 *     (T-SEC-002 owns `requirePermission`); a layout that authorizes would do it once for everything.
 *   - No security headers or CSP: those are per-response concerns owned by T-SEC-006 (CSP nonce,
 *     security headers and frame protections) and must not be faked here.
 *   - No `next/font/google`: the build must not reach the network (docs/research/STACK-2026.md).
 *     Typography uses the token font stacks, which include an Arabic-safe stack.
 *
 * Failure cases: none of its own - a layout has no inputs. A render error in a child is caught by
 * `src/app/error.tsx` (client boundary) and a missing route by `src/app/not-found.tsx`.
 *
 * Task: T-ARCH-001 (shell) -> implemented with the design system in VS-1, the same convention the other
 * shell files in `src/app` use. Still absent and owned elsewhere: T-SEC-006 (headers/CSP), T-OBS-002
 * (structured logging), and the VS-1 accessibility conformance pass.
 */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles/tokens.css";
import "./styles/base.css";

export const metadata: Metadata = {
  // PARIWARA-free, calm wording: the product is an archive of pengajian, not a platform to be sold.
  title: {
    default: "MajelisHub",
    template: "%s · MajelisHub",
  },
  description:
    "Arsip kajian masjid: jadwal, pendaftaran, kehadiran, rekaman dan transkrip yang ditinjau manusia.",
  applicationName: "MajelisHub",
  // Speaker ranking, popularity and authority scoring are forbidden (ADR-0024); no Open Graph image is
  // set until a real, non-generated one exists (AGENTS.md §4.3: no machine-generated religious content).
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Entrance scanning and the short-code page are used outdoors at arm's length (DESIGN.md: FAST AT THE
  // MOSQUE ENTRANCE); the user must always be able to zoom, so maximumScale is never set.
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        {/* Skip link first in the DOM: ACCESSIBILITY.md "Operable" requires skip links. */}
        <a className="skip-link" href="#konten">
          Lewati ke konten
        </a>
        <main id="konten">{children}</main>
      </body>
    </html>
  );
}
