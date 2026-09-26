// HomeOps - feature skeleton (specification phase). Presentation shell only.

/**
 * One alert, rendered with its five answers available and one inline action
 * (docs/design/INTERACTION-PATTERNS.md section 1 and docs/design/PAGES.md section 8).
 * Contract:
 *  - type icon + title + entity link + recipient + age, then [Acknowledge] [Snooze] [Resolve];
 *  - URGENT is never collapsed; grouped resource alerts name critical items individually;
 *  - status is word + shape + colour via the shared StatusBadge primitive;
 *  - a new URGENT alert is announced once with role="alert"; other updates use a polite region.
 * Implemented in T-ALERT-013 / T-ALERT-030 / T-ALERT-031.
 */

export type AlertRowProps = {
  readonly alertId: string;
  readonly title: string;
  readonly priority: 'INFO' | 'ATTENTION' | 'IMPORTANT' | 'URGENT';
  readonly state: string;
  readonly recipientDisplayName: string;
  readonly ageLabel: string;
  readonly canAcknowledge: boolean;
  readonly canSnooze: boolean;
  readonly canResolve: boolean;
};

export function AlertRow(_props: AlertRowProps) {
  return null;
}
