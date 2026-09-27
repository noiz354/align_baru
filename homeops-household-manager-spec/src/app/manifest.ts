// HomeOps - PWA skeleton (specification phase). Contract only.

/**
 * Web app manifest (ADR-014, T-PWA-001). Planned values:
 *   name "HomeOps", short_name "HomeOps", start_url "/today", scope "/",
 *   display "standalone", theme/background from design tokens,
 *   maskable icons at 192 and 512 px.
 *
 * Installability is a VS-13 concern; returning a manifest now would pretend the PWA exists.
 */

// `/manifest.webmanifest` is a static route, so `next build` would execute the not-implemented
// throw while prerendering and fail the build. Marking it dynamic keeps the throw honest (a request
// gets a 500, not a fabricated manifest) without blocking CI. T-PWA-001 removes both lines.
export const dynamic = 'force-dynamic';

export default function manifest() {
  throw new Error('Not implemented: T-PWA-001');
}
