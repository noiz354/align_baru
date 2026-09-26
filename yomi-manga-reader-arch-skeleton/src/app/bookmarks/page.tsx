/**
 * Bookmarks (`/bookmarks`) route shell — authenticated.
 *
 * Requirements: FR-LIBRARY-009/010.
 * Task: T-LIB-008.
 *
 * Behavior: list with manga/chapter/page/note; "Jump" → reader at saved
 * page (deep-link-wins exception, reader-behavior.md §12); remove action
 * (confirm dialog, focus-trapped); unavailable chapters disable the jump.
 * No feature code in this phase.
 */
export default function BookmarksPage() {
  return (
    <main>
      {/* TODO(T-LIB-008): bookmark list + jump + remove (dialog) */}
    </main>
  );
}
