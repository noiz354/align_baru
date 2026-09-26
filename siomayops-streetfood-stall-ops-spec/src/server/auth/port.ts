/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

import type { OperatorId, OrganizationId, Uuid } from "../../shared/types/ids";
import type { Scope } from "../../shared/types/scope";

/** Roles are coarse capability sets (docs/security/PERMISSIONS.md). */
export type Role =
  | "OWNER" | "HQ_OPS" | "HQ_FINANCE" | "AREA_SUPERVISOR" | "MENU_PRICING_ADMIN"
  | "ANALYST" | "AUDITOR" | "OPERATOR";

export interface SessionContext {
  readonly organizationId: OrganizationId;
  readonly userId: Uuid;
  readonly operatorId?: OperatorId;
  readonly roles: readonly Role[];
  readonly scope: Scope;
  readonly deviceId?: string;
  readonly sessionIssuedAt: Date;
}

export type Action =
  | "shift:start" | "shift:suspend" | "shift:close" | "shift:handover"
  | "location:report" | "location:manage"
  | "sale:create" | "sale:void" | "sale:correct"
  | "payment:cash" | "payment:digital" | "payment:reconcile" | "payment:refund"
  | "expense:submit" | "expense:review"
  | "stock:report" | "stock:transfer" | "stock:restock-request"
  | "price:manage" | "price:override" | "price:acknowledge"
  | "menu:manage" | "operator:manage" | "stall:manage" | "assignment:manage"
  | "incident:submit" | "incident:resolve"
  | "loyalty:identify" | "loyalty:redeem" | "loyalty:manage"
  | "hq:read" | "hq:export" | "audit:read" | "config:manage";

export interface AuthPort {
  /** Resolve the current session from the request (cookie-based). */
  resolveSession(): Promise<SessionContext | null>;
  issueOtpChallenge(phoneNumber: string): Promise<{ challengeId: string }>;
  verifyOtpChallenge(challengeId: string, code: string): Promise<SessionContext>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  revokeDevice(deviceId: string, reason: string): Promise<void>;
}

/** Throws. Task: T-FOUND-005. In Phase 0 there is no working auth of any kind. */
export function createAuthPort(): AuthPort {
  throw new Error("Not implemented: T-FOUND-005");
}

/** Throws. Task: T-AUTHZ-001. Single gate used by every use case; denials are audited. */
export function authorize(_session: SessionContext, _action: Action, _target: Scope): void {
  throw new Error("Not implemented: T-AUTHZ-001");
}
