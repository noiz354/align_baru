// HomeOps - PWA skeleton (specification phase). Contract only.

/**
 * Web app manifest (ADR-014, T-PWA-001). Planned values:
 *   name "HomeOps", short_name "HomeOps", start_url "/today", scope "/",
 *   display "standalone", theme/background from design tokens,
 *   maskable icons at 192 and 512 px.
 *
 * Installability is a VS-13 concern; returning a manifest now would pretend the PWA exists.
 */
export default function manifest() {
  throw new Error('Not implemented: T-PWA-001');
}
