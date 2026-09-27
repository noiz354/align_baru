// HomeOps — application shell (T-PLAT-002, DESIGN.md §4, docs/design/PAGES.md).
//
// Bottom navigation with at most five items (Today · Rooms · Chores · Alerts · More), a skip link,
// safe-area padding, and server-rendered counts. Every page is reachable in at most two taps from
// /today; the nav is the same on every household page so orientation never changes (N-1..N-6).

import type { ReactNode } from 'react';
import { STRINGS } from '../strings/en';

export type AppShellProps = {
  readonly children?: ReactNode;
  /** Server-rendered counts; the Alerts badge counts OPEN IMPORTANT/URGENT only (N-2). */
  readonly navCounts?: { readonly alerts?: number };
  /** Which nav item is current, so `aria-current="page"` is correct (ACCESSIBILITY.md §5). */
  readonly active?: 'today' | 'rooms' | 'chores' | 'alerts' | 'more';
  readonly heading?: string;
  readonly headerAction?: ReactNode;
};

/* Icons are 24px stroke paths, not an icon font: no runtime dependency, no layout shift (§1). */
const TODAY_ICON = 'M4 6h16M4 12h16M4 18h10';
const ROOMS_ICON = 'M4 20V9l8-5 8 5v11M9 20v-6h6v6';
const CHORES_ICON = 'M9 11l2 2 4-4M5 5h14v14H5z';
const ALERTS_ICON = 'M12 4l9 16H3zM12 10v4M12 17h.01';
const MORE_ICON = 'M6 12h.01M12 12h.01M18 12h.01';

const NAV_ITEMS = [
  { key: 'today', href: '/today', label: STRINGS.nav.today, icon: TODAY_ICON },
  { key: 'rooms', href: '/rooms', label: STRINGS.nav.rooms, icon: ROOMS_ICON },
  { key: 'chores', href: '/chores', label: STRINGS.nav.chores, icon: CHORES_ICON },
  { key: 'alerts', href: '/alerts', label: STRINGS.nav.alerts, icon: ALERTS_ICON },
  { key: 'more', href: '/more', label: STRINGS.nav.more, icon: MORE_ICON },
] as const;

export function AppShell({ children, navCounts, active, heading, headerAction }: AppShellProps) {
  const alerts = navCounts?.alerts ?? 0;
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        {STRINGS.nav.skipToContent}
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
          <h1 className="text-lg font-semibold">{heading ?? STRINGS.app.name}</h1>
          {headerAction}
        </div>
      </header>

      {/* Bottom padding keeps the last card clear of the nav; env() covers the gesture bar (§4). */}
      <main
        id="main"
        className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <nav
        aria-label={STRINGS.app.name}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex w-full max-w-3xl items-stretch justify-between">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.key;
            const count = item.key === 'alerts' && alerts > 0 ? alerts : null;
            return (
              <li key={item.key} className="flex-1">
                <a
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs ${
                    isActive ? 'text-primary font-semibold' : 'text-text-muted'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{item.label}</span>
                  {count !== null ? (
                    // The badge states a number, never a colour-only signal (NFR-A11Y-003).
                    <span className="rounded-full bg-critical px-1.5 text-[11px] font-semibold text-surface">
                      {count}
                      <span className="sr-only"> {STRINGS.nav.alerts.toLowerCase()} needing attention</span>
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
