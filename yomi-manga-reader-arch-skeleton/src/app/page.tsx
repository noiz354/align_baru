/**
 * Home (`/`) route shell.
 *
 * Requirements: FR-LIBRARY-005 (continue-reading for members),
 * FR-CATALOG-001 (catalog preview for anonymous), NFR-PERF-001 (LCP).
 * Tasks: T-CATALOG-003 (catalog preview), T-LIB-004 (continue list).
 *
 * Behavior (J-1/J-2): anonymous → catalog preview; authenticated →
 * "Continue reading" (≤ 20, most recent first) above the preview.
 * No feature code in this phase.
 */
export default function HomePage() {
  return (
    <main>
      {/* TODO(T-LIB-004): continue-reading section (authenticated) */}
      {/* TODO(T-CATALOG-003): catalog preview grid (all users) */}
    </main>
  );
}
