/**
 * Per-section error boundary: explains what happened, offers retry, and never shows an internal code.
 * Requirement: NFR-OBS-004 (correlation id visible to support, no internals leaked).
 * Task: T-ARCH-001 (shell) -> VS-1.
 *
 * `"use client"` is not optional here: the App Router only accepts a Client Component as an error
 * boundary, and `next build` rejects the file without it. The boundary still renders nothing until
 * T-ARCH-001 delivers the real message + retry + correlation-id surface.
 */
"use client";
export default function ErrorBoundary() {
  // TODO(T-ARCH-001): message + retry + support path with the correlation id only.
  return null;
}
