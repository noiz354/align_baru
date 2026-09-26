/**
 * Admin uploads (`/admin/uploads`) route shell.
 *
 * Requirements: FR-UPLOAD-007/011, FR-ADMIN-008 (upload health).
 * Task: T-UPLOAD-010.
 *
 * Behavior: job list (state machine rendered EXACTLY — queued/validating/
 * processing/ready/failed; 3 s poll while active), failure reasons
 * (typed → human message + cause code + "Try again"), links to results
 * (chapter / reader preview), queue health (pending cap indicator,
 * T-UPLOAD-013). No feature code in this phase.
 */
export default function AdminUploadsPage() {
  return (
    <main>
      {/* TODO(T-UPLOAD-010): job list (live states) + failure reasons */}
    </main>
  );
}
