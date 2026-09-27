// HomeOps — the single string module (DESIGN.md §17 T-7, PRD §2).
//
// Every member-facing sentence lives here so a locale bundle can be added without touching
// components. Copy rules: second person, present tense, no blame, no exclamation marks, numbers
// only when known (T-1..T-6).

export const STRINGS = {
  app: {
    name: 'HomeOps',
    tagline: 'Keep the home running, without the noise.',
  },
  nav: {
    today: 'Today',
    rooms: 'Rooms',
    chores: 'Chores',
    alerts: 'Alerts',
    more: 'More',
    skipToContent: 'Skip to content',
  },
  errors: {
    // E-5: something broke on our side. Apologetic, actionable, and it carries the reference id.
    unexpectedTitle: 'Something went wrong',
    unexpectedBody: 'That did not work, and it is not your fault. Try again in a moment.',
    referenceLabel: 'Reference',
    retry: 'Try again',
    backToToday: 'Back to Today',
    // E-7: we do not recognise this page.
    notFoundTitle: 'We cannot find that page',
    notFoundBody: 'It may have been moved, or the link may be incomplete.',
  },
  status: {
    CLEAN: 'Clean',
    NEEDS_ATTENTION: 'Needs attention',
    DIRTY: 'Dirty',
    CLEANING: 'Being cleaned',
    UNKNOWN: 'Not tracked yet',
    EMPTY: 'Empty',
    AVAILABLE: 'Available',
    ALMOST_FULL: 'Almost full',
    FULL: 'Full',
    COLLECTION_REQUIRED: 'Collection needed',
    SCHEDULED: 'Not done yet',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
    SKIPPED: 'Skipped',
    SNOOZED: 'Snoozed',
    CANCELLED: 'Cancelled',
    OPEN: 'Open',
    ACKNOWLEDGED: 'Acknowledged',
    RESOLVED: 'Resolved',
    EXPIRED: 'Expired',
    LOW: 'Low',
    CRITICAL: 'Critical',
    ENOUGH: 'Enough',
    UNAVAILABLE: 'Unavailable',
  },
  empty: {
    allClearTitle: 'All clear',
    allClearBody: 'Nothing needs attention right now.',
  },
} as const;

export type Strings = typeof STRINGS;

/** Status words are the accessible name of every badge (NFR-A11Y-003: word + shape + colour). */
export function statusWord(status: string): string {
  const table = STRINGS.status as Readonly<Record<string, string>>;
  return table[status] ?? status;
}
