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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 4: features/library.
 *
 * The remove action's confirm dialog is the Dialog primitive (native
 * `<dialog>`, so the focus trap is the platform's, NFR-A11Y-003).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bookmarks',
};

export default function BookmarksPage() {
  return (
    <>
      <h1>Bookmarks</h1>
      {/* TODO(T-LIB-008): bookmark list + jump + remove (dialog) */}
    </>
  );
}
