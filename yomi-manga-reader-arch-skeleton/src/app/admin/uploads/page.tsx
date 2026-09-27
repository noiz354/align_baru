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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 7: features/uploads owns the job
 * state machine; handlers `src/app/api/v1/uploads/*`.
 *
 * The job state is rendered EXACTLY as the machine defines it (queued →
 * validating → processing → ready → failed) and never by colour alone: each
 * state carries its label, and a failure also carries its typed reason
 * (ACCESSIBILITY.md §3.3).
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Uploads',
};

export default function AdminUploadsPage() {
  return (
    <>
      <h1>Uploads</h1>
      {/* TODO(T-UPLOAD-010): job list (live states) + failure reasons */}
    </>
  );
}
