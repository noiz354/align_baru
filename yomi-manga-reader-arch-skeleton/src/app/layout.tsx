/**
 * Root layout (route shell — T-FOUND-003).
 *
 * Requirements: NFR-A11Y-004 (landmarks), FR-CATALOG-006 (route map).
 * Task: T-FOUND-003.
 *
 * Contract: AppShell (landmarks + skip link) wraps all pages; metadata
 * contract per route (title template "%s · Yomi"); no feature code here.
 * TODO(T-FOUND-003): wire AppShell + metadata + font/theme tokens.
 *
 * ── What the root layout owns, and why each piece is here ────────────────
 * `<html lang="en">` — WCAG 2.1 SC 3.1.1 (Language of Page). It has to be
 * set on the document element, so it can only live here; a page cannot set
 * it. `suppressHydrationWarning` is required because the theme is resolved
 * from `color-scheme` (and later from `data-theme` on this element) by the
 * browser, not by React, so the server-rendered attribute can differ from
 * the client's.
 *
 * `metadata` — the per-route contract every page inherits: a default title
 * for the bare `/` route and a template for every other one, so a page only
 * has to name itself. `title: 'Discover'` on a page becomes
 * "Discover · Yomi". No `themeColor` is declared here on purpose: it would
 * be a colour literal in a TS file, and tokens.css is the only place a
 * colour is allowed to be written (T-FOUND-004).
 *
 * `import './…css'` — global stylesheets may only be imported by the root
 * layout in the App Router, which is also why the shell needs no provider.
 *
 * `viewport` — `width=device-width` (Next's default) plus
 * `viewportFit: 'cover'`, because the reader is used on phones with a
 * notched edge (reader-behavior.md §2).
 */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import AppShell from '../shared/ui/AppShell';
import { HydrationBoundary } from '../shared/ui/hydration';
import '../shared/ui/tokens.css';
import '../shared/ui/base.css';

export const metadata: Metadata = {
  // Default for the bare `/` route; every other route uses the template.
  title: {
    default: 'Yomi',
    template: '%s · Yomi',
  },
  applicationName: 'Yomi',
  description: 'Self-hosted manga and comic reader for licensed content.',
  // TODO(T-PROD-006): the canonical origin comes from APP_ORIGIN once
  // T-FOUND-002 owns env loading; a placeholder URL would be a lie in a
  // social card, so no openGraph image ships in this phase.
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Mounted here, and only here: the whole focus/announce
            distinction rests on this NOT remounting on a client-side
            navigation. See shared/ui/hydration.tsx (SQ-A11Y-1). */}
        <HydrationBoundary />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
