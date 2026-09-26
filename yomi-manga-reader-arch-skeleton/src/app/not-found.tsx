/**
 * Not-found page (all 404s).
 *
 * Requirements: NFR-A11Y-003/004, API_CONTRACT (404 policy: no existence
 * leak for private data — THREAT T-04).
 * Task: T-FOUND-003.
 *
 * Contract: labeled state (never a blank `main`), human cause, next
 * action (home / catalog link), initial focus on the content. The SAME
 * page serves "manga not found" and "route not found" — private-data
 * 404s intentionally do not reveal existence.
 */
export default function NotFound() {
  return (
    <main>
      {/* TODO(T-FOUND-003): 404 layout (cause + home/catalog actions, focus) */}
    </main>
  );
}
