/**
 * Queue page — waiting state.
 *
 * Requirements:
 * - FR-QUEUE-001 … FR-QUEUE-008
 * - FR-SAFE-002 (cooldown)
 *
 * See:
 * - docs/design/PAGES.md §1
 * - MATCHMAKING.md §9, §10
 *
 * ROUTE SHELL ONLY. This page is not implemented.
 *
 * FR-ENTRY-005: this route must redirect to /start when consent is absent.
 * Direct URL navigation must not bypass the age gate.
 */

export default function QueuePage(): React.JSX.Element {
  // TODO(T-QUEUE-011): elapsed wait time, honest explanation, visible Cancel.
  // TODO(T-QUEUE-011): on timeout, offer retry or exit — NEVER auto-requeue.
  // TODO(T-QUEUE-012): show a cooldown honestly, never as a network error.
  throw new Error('Not implemented: T-QUEUE-011 (queue route shell)');
}
