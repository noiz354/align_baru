// HomeOps — skeleton (specification phase). Presentation shell only.

/**
 * Application shell: navigation, safe areas, skip-link, and the error boundary.
 * Contract from DESIGN.md §4 and docs/design/PAGES.md:
 *  - bottom navigation has at most five items: Today · Rooms · Chores · Alerts · More;
 *  - every page is reachable in at most two taps from /today;
 *  - nav counts are server-rendered and equal the section counts on the page.
 * Implemented in T-PLAT-002.
 */

export type AppShellProps = {
  readonly children?: unknown;
  /** Server-rendered counts; the Alerts badge counts OPEN IMPORTANT/URGENT only (N-2). */
  readonly navCounts?: { readonly alerts?: number };
};

export function AppShell(_props: AppShellProps) {
  return null;
}
