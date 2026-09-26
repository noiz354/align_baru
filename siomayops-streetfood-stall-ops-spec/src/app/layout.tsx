/**
 * PHASE 0 — LAYOUT SHELL. No providers, no data fetching, no service worker, no analytics.
 * The real shell (offline banner, sync state, auth context, design tokens) arrives with
 * T-FOUND-002 and T-OFF-002.
 */
import type { ReactNode } from "react";

export const metadata = {
  title: "SiomayOps",
  description: "Phase 0 shell — specification and skeletons only."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
