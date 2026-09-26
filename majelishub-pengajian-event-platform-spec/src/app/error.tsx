/**
 * Per-section error boundary: explains what happened, offers retry, and never shows an internal code.
 * Requirement: NFR-OBS-004 (correlation id visible to support, no internals leaked).
 * Task: T-ARCH-001 (shell) -> VS-1.
 */
export default function ErrorBoundary() {
  // TODO(T-ARCH-001): message + retry + support path with the correlation id only.
  return null;
}
