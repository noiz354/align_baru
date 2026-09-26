/**
 * Safety centre page.
 *
 * Requirements:
 * - NFR-SAFE-003 (honest limitations)
 * - FR-SAFE-007 (moderation visible)
 *
 * See:
 * - docs/design/PAGES.md §1
 * - SAFETY.md §1
 *
 * ROUTE SHELL ONLY. This page is not implemented.
 *
 * It must NOT claim perfect moderation, verified ages, or complete anonymity.
 */

/** The eight published limitations. See SAFETY.md §1. */
export const SAFETY_LIMITATIONS = [
  {
    title: 'Conversations are not screened in real time',
    body: 'A human cannot read a message before you see it.',
  },
  {
    title: 'No moderation system is perfect',
    body: 'Some harmful content will be seen before it is stopped.',
  },
  {
    title: 'We cannot verify who someone is',
    body: 'A banned user may return under a new identity.',
  },
  {
    title: 'Your network may be visible during a call',
    body: 'During an audio or video call, the other person may be able to determine your approximate location from your internet connection.',
  },
  {
    title: 'We do not keep a record of your conversation',
    body: 'We usually cannot show a moderator what was said.',
  },
  {
    title: 'Blocking has limits',
    body: 'Blocking prevents someone matching with you again through StrangerLink. It cannot stop them returning under a new identity.',
  },
  {
    title: 'Age is self-declared',
    body: 'We cannot prove a user is 18.',
  },
  {
    title: 'We cannot guarantee no minor will ever use the service',
    body: 'The age gate raises the cost of participation; it does not eliminate the possibility.',
  },
] as const;

export default function SafetyPage(): React.JSX.Element {
  // TODO(T-SAFE-052): render the limitations in plain language, with a
  // logical heading hierarchy.
  throw new Error('Not implemented: T-SAFE-052 (safety route shell)');
}
