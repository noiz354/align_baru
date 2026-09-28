/**
 * Reading history (`/history`) route shell — authenticated.
 *
 * Requirements: FR-LIBRARY-008, FR-READER-015.
 * Task: T-LIB-005.
 *
 * Behavior: newest-first list (manga title, chapter, deepest page,
 * last-read local time), cursor load-more, deleted chapters rendered
 * "Unavailable chapter" (row retained), empty state. No feature code.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 4: features/library and
 * features/progress (progress owns the session boundary, §2.3).
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'History',
};

export default function HistoryPage() {
  return (
    <>
      <h1>History</h1>
      <NotYetBuilt
        headingId="history-not-built"
        task="T-LIB-005"
        intent="list the chapters you have read, most recent first"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
      {/* TODO(T-LIB-005): history list */}
    </>
  );
}
