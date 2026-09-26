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
 */
export default function LibraryPage() {
  return (
    <main>
      {/* TODO(T-LIB-003): library grid + sort + empty state */}
    </main>
  );
}
