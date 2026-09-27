/**
 * Library (`/library`) route shell — authenticated (FR-AUTH-007).
 *
 * Requirements: FR-LIBRARY-003/004, NFR-A11Y-004.
 * Tasks: T-LIB-003 (UI).
 *
 * Behavior: entry grid (cover, title, "Ch. N · p. M", unread badge
 * icon+count — never color-only), sort control (last-read default),
 * cursor load-more, empty state (→ catalog CTA). Anonymous ⇒ redirect
 * to sign-in (with ?next=). No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 4: features/library and
 * features/progress; handlers `src/app/api/v1/library*` and the
 * read-status operations.
 *
 * The redirect for an anonymous visitor is T-LIB-003's behaviour (it needs
 * the session this phase does not have), so this shell renders for everyone.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Library',
};

export default function LibraryPage() {
  return (
    <>
      <h1>Library</h1>
      {/* TODO(T-LIB-003): library grid + sort + empty state */}
    </>
  );
}
