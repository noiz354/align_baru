/**
 * Authorization enforcement - the single choke point.
 *
 * Where this belongs: server layer; every route, Server Action and job calls it. This path is cited by
 * docs/security/AUTHZ-MATRIX.md as the implementation site.
 * Specification: SECURITY.md §3/§4, docs/security/AUTHZ-MATRIX.md (9 roles x resources, scopes
 *   PLATFORM/ORG/MOSQUE/EVENT/OWN, `✓*` = reason >= 8 characters required and audited), TASKS.md T-SEC-002.
 *
 * Invariants implemented (T-SEC-002, delivered 2026-09-27):
 *   1. Role -> permission is DATA (`AUTHORIZATION_MATRIX`), so the generated matrix test can walk every
 *      cell and so no route performs its own role comparison.
 *   2. Unauthorized access to another organization's object returns NOT_FOUND (no existence
 *      disclosure); a permission the role simply does not hold returns FORBIDDEN.
 *   3. Separation of duties: a person cannot approve a subject they own, moderation decisions and
 *      verification are platform-only, and no one can grant a role beyond their own authority.
 *   4. Reason-required permissions fail without a reason of >= 8 characters, and every reason-required
 *      grant is recorded (SECURITY.md §12).
 *   5. Every denial writes an authorization event; no event carries resource content.
 *   6. Unknown permission key, missing actor, or a broken scope chain fail closed.
 *
 * Failure cases: unknown permission key (deny + alert event) · no roles (deny) · role lookup failure
 * (deny - the caller passes the roles it read, an empty list denies) · broken scope chain (deny) ·
 * missing actor (unauthenticated).
 *
 * Task ownership: T-SEC-002 (delivered), T-SEC-001 (scope), T-SEC-007 (durable audit linkage - until
 * then events go through the security-event sink).
 */
import {
  REASON_REQUIRED_PERMISSIONS,
  ROLE_KEYS,
  isRoleKey,
  type Actor,
  type PermissionKey,
  type RoleKey,
} from "@/shared/contracts/permissions";
import { AppError } from "@/shared/contracts/errors";
import { isWithinScope, mosqueScope, organizationScope, platformScope, type ScopeKind, type TenantScope } from "@/shared/contracts/scope";
import type { DbHandle } from "@/server/db/client";
import { findActiveMembership, listActiveMembershipsForUser } from "@/server/db/repositories/organizations";
import {
  buildAuthorizationEvent,
  buildReasonRecordedEvent,
  recordAuthorizationEvent,
  recordSecurityEvent,
  type AuthorizationOutcome,
} from "@/server/auth/authorization-events";

export interface AuthorizationContext {
  readonly actor: Actor;
  readonly permission: PermissionKey;
  readonly scopeKind: ScopeKind;
  readonly resource?: { readonly organizationId: string; readonly mosqueId?: string; readonly eventId?: string; readonly ownerId?: string };
  readonly reason?: string;
  /**
   * Owner of the subject being acted on, when separation of duties applies (e.g. the author of the
   * transcript revision under approval). Compared with the actor's own id.
   */
  readonly subjectOwnerId?: string;
  /** Roles requested in a membership grant - checked against the actor's own authority. */
  readonly requestedRoles?: readonly string[];
  /** Device binding for entrance operations (FR-CHECKIN-002, AUTHZ-MATRIX §4.3). */
  readonly deviceBinding?: { readonly eventId: string; readonly entranceId?: string };
}

/** Outcome of one matrix cell. `DENY` is the default for every cell that is not listed. */
export type Grant = "ALLOW" | "ALLOW_OWN" | "ALLOW_WITH_REASON" | "ALLOW_DEVICE_BOUND";

export interface MatrixRow {
  readonly key: PermissionKey;
  /** Where this row comes from in `docs/security/AUTHZ-MATRIX.md` (row name or rule number). */
  readonly doc: string;
  readonly grants: Readonly<Partial<Record<RoleKey, Grant>>>;
}

const A = "ALLOW" as const;
const OWN = "ALLOW_OWN" as const;
const R = "ALLOW_WITH_REASON" as const;
const D = "ALLOW_DEVICE_BOUND" as const;

/**
 * The matrix, transcribed from `docs/security/AUTHZ-MATRIX.md` §3 with §4's rules folded in.
 *
 * Two transcription rules were applied where the document and the shared contract differ, both in the
 * stricter direction (recorded in AUTHZ-MATRIX.md §4.5):
 *   - a key listed in `REASON_REQUIRED_PERMISSIONS` requires a reason for EVERY role that holds it,
 *     even where the matrix cell shows a plain ✓;
 *   - `⬤` (own record only) becomes `ALLOW_OWN`, which the caller must satisfy with `resource.ownerId`.
 */
export const AUTHORIZATION_MATRIX: readonly MatrixRow[] = [
  { key: "organization.read", doc: "§1 scope + FR-ORG-001", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: R } },
  { key: "organization.write", doc: "FR-ORG-004 defaults", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "organization.member.manage", doc: "member.grant/revoke", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "mosque.read", doc: "§1 (implied by venue/entrance work)", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, PLATFORM_ADMIN: R } },
  { key: "mosque.write", doc: "mosque.create/write", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "mosque.venue.write", doc: "venue.write", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "mosque.share.grant", doc: "§4.5 (exposes contact data)", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "speaker.read", doc: "speaker.read.public + own profile", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "speaker.write", doc: "speaker.write (+ speaker.create)", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: R, PLATFORM_ADMIN: A } },
  { key: "speaker.verify", doc: "speaker.verify (platform only)", grants: { PLATFORM_ADMIN: R } },
  { key: "program.read", doc: "program.write/generate", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "program.write", doc: "program.write/generate", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "event.read", doc: "§1 (organizer surfaces)", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, AUDIO_OPERATOR: A, TRANSCRIPT_REVIEWER: A, PLATFORM_ADMIN: R } },
  { key: "event.write", doc: "event.create/write", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "event.publish", doc: "event.publish/cancel", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: R, PLATFORM_ADMIN: A } },
  { key: "event.cancel", doc: "event.publish/cancel + REASON_REQUIRED", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "registration.read", doc: "registration.read", grants: { PARTICIPANT: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: R } },
  { key: "registration.manage", doc: "registration.manage", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "registration.export", doc: "attendance/feedback export rules", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "checkin.validate", doc: "checkin.validate (✓ᵈ for volunteers)", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: D, PLATFORM_ADMIN: A } },
  { key: "checkin.record", doc: "checkin.manual", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, PLATFORM_ADMIN: A } },
  { key: "checkin.walkin", doc: "checkin.walk_in", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, PLATFORM_ADMIN: A } },
  { key: "checkin.session.bind", doc: "§4.3 device binding (audited)", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, PLATFORM_ADMIN: A } },
  { key: "checkin.correct", doc: "FR-ATTEND-004 manual correction (reason + audit)", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "attendance.read", doc: "attendance.read", grants: { PARTICIPANT: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, VOLUNTEER: A, PLATFORM_ADMIN: R } },
  { key: "attendance.correct", doc: "attendance.correct + REASON_REQUIRED", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "attendance.export", doc: "attendance.export", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "audio.record", doc: "recording.operate", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, AUDIO_OPERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audio.read", doc: "audio.read", grants: { PARTICIPANT: A, SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, AUDIO_OPERATOR: A, TRANSCRIPT_REVIEWER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audio.process", doc: "audio.process", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, AUDIO_OPERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audio.publish", doc: "audio.publish", grants: { SPEAKER: R, MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audio.withdraw", doc: "content.unpublish (audio)", grants: { SPEAKER: OWN, MOSQUE_ADMIN: R, ORGANIZER: R, TRANSCRIPT_REVIEWER: R, MODERATOR: R, PLATFORM_ADMIN: R } },
  { key: "transcript.request", doc: "transcription.request", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "transcript.read", doc: "transcript.read", grants: { PARTICIPANT: A, SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, TRANSCRIPT_REVIEWER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "transcript.edit", doc: "transcript.review", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, TRANSCRIPT_REVIEWER: A, PLATFORM_ADMIN: A } },
  { key: "transcript.approve", doc: "transcript.approve (SoD)", grants: { SPEAKER: R, ORGANIZER: R, TRANSCRIPT_REVIEWER: R, PLATFORM_ADMIN: R } },
  { key: "transcript.publish", doc: "content.publish + REASON_REQUIRED", grants: { SPEAKER: R, MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "content.read", doc: "content.read.public + drafts", grants: { PARTICIPANT: A, SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, TRANSCRIPT_REVIEWER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "content.publish", doc: "content.publish", grants: { SPEAKER: R, MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: R } },
  { key: "content.withdraw", doc: "content.unpublish", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: R, TRANSCRIPT_REVIEWER: R, MODERATOR: R, PLATFORM_ADMIN: R } },
  { key: "content.material.manage", doc: "content.manage.materials/chapters", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: A } },
  { key: "feedback.submit", doc: "FR-FEEDBACK-001/002", grants: { PARTICIPANT: A } },
  { key: "feedback.read", doc: "feedback.read", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, PLATFORM_ADMIN: R } },
  { key: "feedback.moderate", doc: "feedback.report + moderation.decide", grants: { MODERATOR: R, PLATFORM_ADMIN: R } },
  { key: "notification.template.manage", doc: "NOTIFICATIONS.md catalogue (platform)", grants: { PLATFORM_ADMIN: R } },
  { key: "notification.replay", doc: "NFR-REL-005 dead-letter replay", grants: { PLATFORM_ADMIN: R } },
  { key: "analytics.read", doc: "FR-ANALYTICS-001/003 (aggregate only)", grants: { SPEAKER: OWN, MOSQUE_ADMIN: A, ORGANIZER: A, AUDIO_OPERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audit.read", doc: "audit.read", grants: { MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "audit.export", doc: "audit export (audited)", grants: { MOSQUE_ADMIN: R, ORGANIZER: R, PLATFORM_ADMIN: R } },
  { key: "moderation.report", doc: "feedback.report / FR-MOD-002", grants: { PARTICIPANT: A, SPEAKER: A, MOSQUE_ADMIN: A, ORGANIZER: A, MODERATOR: A, PLATFORM_ADMIN: A } },
  { key: "moderation.decide", doc: "moderation.decide (platform only)", grants: { MODERATOR: R, PLATFORM_ADMIN: R } },
  { key: "platform.operate", doc: "ops.* (platform only, audited)", grants: { PLATFORM_ADMIN: R } },
  { key: "platform.config.manage", doc: "ops.provider (platform only)", grants: { PLATFORM_ADMIN: R } },
];

/** Permissions that may never be granted to a role below platform trust (AUTHZ-MATRIX §4.7). */
export const PLATFORM_ONLY_PERMISSIONS: readonly PermissionKey[] = [
  "speaker.verify",
  "moderation.decide",
  "feedback.moderate",
  "platform.operate",
  "platform.config.manage",
  "notification.template.manage",
  "notification.replay",
];

/** Permissions where the actor must not be the owner of the subject (AUTHZ-MATRIX §4.2, ADR-0012). */
export const SEPARATION_OF_DUTIES_PERMISSIONS: readonly PermissionKey[] = ["transcript.approve"];

/** Roles an organizer-level actor may never grant to somebody else (AUTHZ-MATRIX §4.6). */
export const NON_DELEGABLE_ROLES: readonly RoleKey[] = ["PLATFORM_ADMIN", "MODERATOR"];

const MIN_REASON_LENGTH = 8;

export function matrixRow(key: PermissionKey): MatrixRow | undefined {
  return AUTHORIZATION_MATRIX.find((row) => row.key === key);
}

/** The grant a single role holds for a permission; `undefined` means DENY. */
export function grantForRole(role: string, key: PermissionKey): Grant | undefined {
  if (!isRoleKey(role)) return undefined;
  return matrixRow(key)?.grants[role];
}

/**
 * Role -> permission mapping is DATA (a table), so the generated matrix test can walk every row.
 * Unknown roles return an empty list - never a default set.
 */
export function permissionsForRole(role: string): readonly PermissionKey[] {
  if (!isRoleKey(role)) return [];
  return AUTHORIZATION_MATRIX.filter((row) => row.grants[role] !== undefined).map((row) => row.key);
}

/** Every permission key the matrix knows; used by the generated test and by the UI allow-list. */
export function allPermissionKeys(): readonly PermissionKey[] {
  return AUTHORIZATION_MATRIX.map((row) => row.key);
}

/** True when the permission demands a stored reason, either by the contract list or by the cell. */
export function requiresReason(key: PermissionKey, grant: Grant | undefined): boolean {
  return grant === R || REASON_REQUIRED_PERMISSIONS.includes(key);
}

/**
 * The one authorization call. Throws a typed error; never returns a boolean, never allows silently.
 *
 * Order matters: identity -> key validity -> role grant -> reason -> separation of duties -> scope.
 * A cross-organization resource is reported as NOT_FOUND (existence privacy) rather than FORBIDDEN.
 *
 * @throws AppError(UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | VALIDATION_FAILED)
 */
export function requirePermission(context: AuthorizationContext): void {
  const { actor, permission } = context;

  if (!actor || !actor.userId || actor.userId.trim() === "") {
    throw AppError.unauthenticated();
  }
  if (!matrixRow(permission)) {
    // Fail closed and make the defect visible: an unknown key is a programming error, not a user error.
    deny(context, "DENIED_UNKNOWN_PERMISSION");
    throw AppError.forbidden("Tindakan tidak dikenal.");
  }
  if (actor.roles.length === 0) {
    deny(context, "DENIED_NO_ROLE");
    throw AppError.forbidden();
  }

  // 1. Role grant (the strongest grant the actor's roles give them).
  const grants = actor.roles.map((role) => grantForRole(role, permission)).filter((g): g is Grant => g !== undefined);
  if (grants.length === 0) {
    // A role that does not hold the key at all. If the resource belongs to another organization the
    // answer must not disclose that it exists.
    if (context.resource && !isWithinScope(actor.scope, context.resource)) {
      deny(context, "DENIED_CROSS_ORGANIZATION");
      throw AppError.notFound();
    }
    deny(context, "DENIED_ROLE");
    throw AppError.forbidden();
  }

  const grant = pickStrongest(grants);

  // 2. Ownership for `OWN` grants (AUTHZ-MATRIX §4.2).
  if (grant === OWN) {
    const ownerId = context.resource?.ownerId;
    if (ownerId === undefined || ownerId !== actor.userId) {
      deny(context, "DENIED_NOT_OWNED");
      throw AppError.forbidden("Anda hanya dapat mengakses data milik sendiri.");
    }
  }

  // 3. Device binding for entrance scanning (AUTHZ-MATRIX §4.3).
  if (grant === D) {
    const boundEventId = context.deviceBinding?.eventId;
    if (boundEventId === undefined || boundEventId !== context.resource?.eventId) {
      deny(context, "DENIED_DEVICE_NOT_BOUND");
      throw AppError.forbidden("Perangkat belum terikat ke kegiatan ini.");
    }
  }

  // 4. Reason-required actions (AUTHZ-MATRIX §4.5).
  if (requiresReason(permission, grant)) {
    const reason = context.reason?.trim() ?? "";
    if (reason.length < MIN_REASON_LENGTH) {
      deny(context, "DENIED_MISSING_REASON");
      throw AppError.validation("Tindakan ini memerlukan alasan minimal 8 karakter.");
    }
  }

  // 5. Separation of duties (ADR-0012): nobody approves their own work.
  if (SEPARATION_OF_DUTIES_PERMISSIONS.includes(permission) && context.subjectOwnerId === actor.userId) {
    deny(context, "DENIED_SEPARATION_OF_DUTIES");
    throw AppError.forbidden("Anda tidak dapat menyetujui hasil kerja Anda sendiri.");
  }

  // 6. No self-escalation, and no grant beyond the actor's own authority (AUTHZ-MATRIX §4.6).
  if (permission === "organization.member.manage" && context.requestedRoles) {
    assertCanGrantRoles(actor.roles, context.requestedRoles, actor.userId, context.resource?.ownerId, {
      organizationId: actor.scope.organizationId,
      scopeKind: actor.scope.kind,
    });
  }

  // 7. Scope chain: the resource must be inside the actor's scope (ADR-0017 layer 1).
  if (context.resource && !isWithinScope(actor.scope, context.resource)) {
    deny(context, "DENIED_CROSS_ORGANIZATION");
    throw AppError.notFound();
  }

  // Allowed. Reason-required grants are recorded as authorization changes (SECURITY.md §12).
  if (requiresReason(permission, grant)) {
    recordSecurityEvent(
      buildReasonRecordedEvent({
        permission,
        actorUserId: actor.userId,
        organizationId: actor.scope.organizationId,
        scopeKind: actor.scope.kind,
        reason: context.reason?.trim() ?? "",
        now: new Date(),
      }),
    );
  }
}

/**
 * A member cannot grant a role they do not hold, cannot grant a platform-trust role, and cannot grant
 * anything to themselves (AUTHZ-MATRIX §4.6).
 *
 * @throws AppError(FORBIDDEN)
 */
export function assertCanGrantRoles(
  actorRoles: readonly string[],
  requestedRoles: readonly string[],
  actorUserId: string,
  targetUserId?: string,
  context?: { organizationId: string; scopeKind: ScopeKind },
): void {
  const refuse = (message: string): never => {
    if (context) {
      recordAuthorizationEvent(
        buildAuthorizationEvent({
          outcome: "DENIED_SELF_ESCALATION",
          actorUserId,
          organizationId: context.organizationId,
          scopeKind: context.scopeKind,
          targetType: "organization_member",
          permission: "organization.member.manage",
          now: new Date(),
        }),
      );
    }
    throw AppError.forbidden(message);
  };

  if (requestedRoles.length === 0) {
    throw AppError.validation("Pilih minimal satu peran.");
  }
  if (targetUserId !== undefined && targetUserId === actorUserId) {
    return refuse("Anda tidak dapat mengubah peran Anda sendiri.");
  }
  for (const role of requestedRoles) {
    if (!isRoleKey(role)) throw AppError.validation("Peran tidak dikenal.");
    if ((NON_DELEGABLE_ROLES as readonly string[]).includes(role)) {
      return refuse("Peran tingkat platform tidak dapat diberikan oleh pengurus.");
    }
    if (!actorRoles.includes(role)) {
      return refuse("Anda tidak dapat memberikan peran yang tidak Anda miliki.");
    }
  }
}

function pickStrongest(grants: readonly Grant[]): Grant {
  if (grants.includes(A)) return A;
  if (grants.includes(D)) return D;
  if (grants.includes(OWN)) return OWN;
  return R;
}

function deny(context: AuthorizationContext, outcome: AuthorizationOutcome): void {
  recordAuthorizationEvent(
    buildAuthorizationEvent({
      outcome,
      actorUserId: context.actor?.userId,
      organizationId: context.actor?.scope.organizationId ?? "",
      scopeKind: context.actor?.scope.kind ?? "ORG",
      targetType: "action",
      permission: context.permission,
      now: new Date(),
    }),
  );
}

/* -------------------------------------------------------------------------------------------- */
/* Scope derivation (T-SEC-001, delivered 2026-09-27)                                            */
/* -------------------------------------------------------------------------------------------- */

/**
 * The authenticated principal a scope is derived from. `organizationId`/`mosqueId` express which of the
 * person's memberships this request acts under - a UI selection, never an authorization grant: the
 * membership is re-read from the database on every derivation, so a stale or forged selection cannot
 * widen access (ADR-0017 layer 1).
 */
export interface SessionPrincipal {
  readonly userId: string;
  readonly organizationId?: string;
  readonly mosqueId?: string;
}

/**
 * Derive the tenant scope from the principal - never from request input (ADR-0017).
 *
 * Rules (SECURITY.md §3 "Scope resolution: actor -> memberships -> TenantScope"):
 *   1. No membership at all, or a membership that is not ACTIVE -> FORBIDDEN. Absence of a scope is
 *      never treated as "all organizations" and never as a default.
 *   2. No organization selected and exactly one active membership -> that membership is used.
 *      More than one -> FORBIDDEN: the person must choose, we do not guess.
 *   3. A membership limited to a subset of mosques (FR-ORG-005) yields a MOSQUE scope; asking for a
 *      mosque outside the subset is FORBIDDEN, not silently widened.
 *   4. PLATFORM_ADMIN yields a PLATFORM scope. Platform actions are still reason-required and audited
 *      at the permission layer (AUTHZ-MATRIX §4.7); the scope alone grants nothing.
 *   5. EVENT scopes are not derived here yet: there is no events table until VS-2 (T-EVENT-001), and an
 *      event scope must be validated against the event's own organization.
 *
 * Failure cases: membership row missing (deny) · database failure (propagate - a scope cannot be
 * invented) · malformed selection (deny).
 *
 * Task ownership: T-SEC-001 (delivered 2026-09-27).
 */
export async function deriveScope(handle: DbHandle, principal: SessionPrincipal): Promise<TenantScope> {
  if (!principal.userId || principal.userId.trim() === "") {
    throw AppError.unauthenticated();
  }

  if (principal.organizationId === undefined) {
    const memberships = await listActiveMembershipsForUser(handle, principal.userId);
    if (memberships.length === 0) throw AppError.forbidden("Akun Anda belum terhubung ke organisasi mana pun.");
    if (memberships.length > 1) throw AppError.forbidden("Pilih organisasi yang ingin digunakan.");
    const only = memberships[0];
    if (!only) throw AppError.forbidden("Pilih organisasi yang ingin digunakan.");
    return scopeFromMembership(only.organizationId, only.roles, only.mosqueIds, undefined);
  }

  const membership = await findActiveMembership(handle, principal.userId, principal.organizationId);
  if (!membership) throw AppError.forbidden("Anda bukan anggota aktif organisasi ini.");
  return scopeFromMembership(
    membership.organizationId,
    membership.roles,
    membership.mosqueIds,
    principal.mosqueId,
  );
}

function scopeFromMembership(
  organizationId: string,
  roles: readonly string[],
  mosqueIds: readonly string[] | null,
  requestedMosqueId: string | undefined,
): TenantScope {
  if (roles.includes("PLATFORM_ADMIN")) return platformScope(organizationId);

  const limited = mosqueIds ?? [];
  if (requestedMosqueId !== undefined) {
    if (limited.length > 0 && !limited.includes(requestedMosqueId)) {
      // A volunteer responsible for mosque A has no rights at mosque B (AUTHZ-MATRIX §4.1).
      throw AppError.forbidden("Anda tidak bertugas di masjid ini.");
    }
    return mosqueScope(organizationId, requestedMosqueId);
  }
  if (limited.length === 1 && limited[0] !== undefined) return mosqueScope(organizationId, limited[0]);
  return organizationScope(organizationId);
}

/** Re-exported so callers have one import site for the vocabulary. */
export { ROLE_KEYS, type RoleKey };
