/**
 * Permission vocabulary - `<resource>.<action>` keys and the scopes they can be held in.
 *
 * Where this belongs: `shared/contracts` (used by server enforcement, UI affordances, the audit
 * trail and the generated authorization tests).
 * Specification: docs/security/AUTHZ-MATRIX.md (9 roles x resources; `✓*` = reason >= 8 characters
 * required and audited), SECURITY.md §4.
 *
 * Invariants:
 *   1. Enforcement happens server-side in exactly one function per request
 *      (`requirePermission`, src/server/auth/permissions.ts - T-SEC-002).
 *   2. UI hiding is never a control; the same key gates the API and the button.
 *   3. Reason-required keys (REASON_REQUIRED_PERMISSIONS below) fail without a stored reason.
 *   4. Separation of duties: a reviewer cannot approve their own revision, and moderation decisions
 *      are platform-only (ADR-0012, SECURITY.md §4).
 */
export type PermissionKey =
  | "organization.read" | "organization.write" | "organization.member.manage"
  | "mosque.read" | "mosque.write" | "mosque.venue.write" | "mosque.share.grant"
  | "speaker.read" | "speaker.write" | "speaker.verify"
  | "program.read" | "program.write"
  | "event.read" | "event.write" | "event.publish" | "event.cancel"
  | "registration.read" | "registration.manage" | "registration.export"
  | "checkin.validate" | "checkin.record" | "checkin.walkin" | "checkin.session.bind" | "checkin.correct"
  | "attendance.read" | "attendance.correct" | "attendance.export"
  | "audio.record" | "audio.read" | "audio.process" | "audio.publish" | "audio.withdraw"
  | "transcript.request" | "transcript.read" | "transcript.edit" | "transcript.approve" | "transcript.publish"
  | "content.read" | "content.publish" | "content.withdraw" | "content.material.manage"
  | "feedback.submit" | "feedback.read" | "feedback.moderate"
  | "notification.template.manage" | "notification.replay"
  | "analytics.read"
  | "audit.read" | "audit.export"
  | "moderation.report" | "moderation.decide"
  | "platform.operate" | "platform.config.manage";

/** Keys that require a stored reason (matrix `✓*`). Length >= 8, audited (SECURITY.md §4). */
export const REASON_REQUIRED_PERMISSIONS: readonly PermissionKey[] = [
  "attendance.correct", "registration.export", "attendance.export",
  "transcript.publish", "content.withdraw", "audio.withdraw",
  "moderation.decide", "platform.config.manage", "event.cancel", "audit.export",
];

/** Actor shape as authorization sees it: roles + scope, never a raw user object. */
export interface Actor {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly scope: import("./scope").TenantScope;
  /** Present only for capability-based participants (registration/feedback tokens). */
  readonly capability?: { readonly kind: string; readonly subjectId: string };
}
