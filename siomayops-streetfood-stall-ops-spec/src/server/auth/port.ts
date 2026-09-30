import type { OperatorId, OrganizationId, Uuid } from "../../shared/types/ids";
import type { Scope } from "../../shared/types/scope";

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
  | "shift:start" | "shift:suspend" | "shift:close" | "shift:handover" | "shift:view"
  | "location:report" | "location:manage" | "location:view"
  | "sale:create" | "sale:void" | "sale:correct" | "sale:view"
  | "payment:cash" | "payment:digital" | "payment:reconcile" | "payment:refund" | "payment:view"
  | "expense:submit" | "expense:review" | "expense:view"
  | "stock:report" | "stock:transfer" | "stock:restock-request" | "stock:view"
  | "price:manage" | "price:override" | "price:acknowledge"
  | "menu:manage" | "menu:view" | "operator:manage" | "stall:manage" | "assignment:manage"
  | "incident:submit" | "incident:resolve" | "incident:view"
  | "loyalty:identify" | "loyalty:redeem" | "loyalty:manage"
  | "hq:read" | "hq:view" | "hq:export" | "audit:read" | "audit:view" | "config:manage" | "config:view"
  | "evidence:upload" | "evidence:view" | "traffic-sample:view" | "traffic-sample:create"
  | "site-condition:view" | "site-condition:create" | "notification:view";

export interface AuthPort {
  resolveSession(): Promise<SessionContext | null>;
  issueOtpChallenge(phoneNumber: string): Promise<{ challengeId: string }>;
  verifyOtpChallenge(challengeId: string, code: string): Promise<SessionContext>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  revokeDevice(deviceId: string, reason: string): Promise<void>;
}

const DEFAULT_ORG_ID = "00000000-0000-7000-0000-000000000001";

export function createAuthPort(): AuthPort {
  return {
    async resolveSession(): Promise<SessionContext | null> {
      // This repository has no real session adapter yet. Never turn the development actor
      // into a production authentication bypass; protected production routes fail closed.
      if (process.env.NODE_ENV === "production") return null;

      const configuredRole = process.env.FAKE_AUTH_ROLE || "HQ_OPS";
      const allowedRoles: readonly Role[] = ["OWNER", "HQ_OPS", "HQ_FINANCE", "AREA_SUPERVISOR", "MENU_PRICING_ADMIN", "ANALYST", "AUDITOR", "OPERATOR"];
      if (!allowedRoles.includes(configuredRole as Role)) return null;
      const role = configuredRole as Role;
      const organizationId = process.env.FAKE_ORG_ID || DEFAULT_ORG_ID;
      const operatorId = role === "OPERATOR" ? process.env.FAKE_OPERATOR_ID || undefined : undefined;
      let scope: Scope;
      if (role === "OPERATOR") {
        if (!operatorId) return null;
        scope = { kind: "self", organizationId, operatorId };
      } else if (role === "AREA_SUPERVISOR") {
        const areaId = process.env.FAKE_AUTH_AREA_ID;
        if (!areaId) return null;
        scope = { kind: "area", organizationId, areaId };
      } else {
        scope = { kind: "org", organizationId };
      }
      return {
        organizationId,
        userId: "00000000-0000-7000-0000-000000000002",
        operatorId,
        roles: [role],
        scope,
        sessionIssuedAt: new Date(),
      };
    },
    async issueOtpChallenge(_phoneNumber: string) {
      return { challengeId: "fake-challenge-id" };
    },
    async verifyOtpChallenge(_challengeId: string, _code: string) {
      const scope: Scope = {
        kind: "self",
        organizationId: DEFAULT_ORG_ID,
        operatorId: "00000000-0000-7000-0000-000000000010",
      };
      return {
        organizationId: DEFAULT_ORG_ID,
        userId: "00000000-0000-7000-0000-000000000002",
        operatorId: scope.operatorId,
        roles: ["OPERATOR"],
        scope,
        sessionIssuedAt: new Date(),
      };
    },
    async revokeSession(_sessionId: string, _reason: string) {
      // noop in fake
    },
    async revokeDevice(_deviceId: string, _reason: string) {
      // noop
    },
  };
}

const ROLE_PERMISSIONS: Record<Role, Set<Action>> = {
  OWNER: new Set([
    "hq:read", "hq:view", "hq:export", "audit:read", "audit:view", "config:manage", "config:view",
    "operator:manage", "stall:manage", "assignment:manage",
    "price:manage", "price:override", "menu:manage", "menu:view",
    "expense:review", "expense:view", "payment:reconcile", "payment:refund", "payment:view",
    "shift:start", "shift:suspend", "shift:close", "shift:handover", "shift:view",
    "location:report", "location:manage", "location:view",
    "sale:create", "sale:void", "sale:correct", "sale:view",
    "payment:cash", "payment:digital",
    "expense:submit", "stock:report", "stock:transfer", "stock:restock-request", "stock:view",
    "incident:submit", "incident:resolve", "incident:view",
    "loyalty:identify", "loyalty:redeem", "loyalty:manage",
    "evidence:upload", "evidence:view", "notification:view",
  ]),
  HQ_OPS: new Set([
    "hq:read", "hq:view", "hq:export", "operator:manage", "stall:manage", "assignment:manage",
    "price:manage", "menu:manage", "menu:view", "location:manage", "location:view",
    "shift:suspend", "shift:view", "incident:resolve", "incident:view", "stock:transfer", "stock:view",
    "expense:review", "expense:view", "sale:view", "payment:view",
    "evidence:view", "notification:view", "audit:view", "config:view",
  ]),
  HQ_FINANCE: new Set([
    "hq:read", "hq:view", "hq:export", "audit:read", "audit:view",
    "payment:reconcile", "payment:refund", "payment:view",
    "expense:review", "expense:view",
    "price:manage", "sale:view", "config:view", "evidence:view", "notification:view",
  ]),
  AREA_SUPERVISOR: new Set([
    "hq:read", "hq:view", "location:manage", "location:view", "price:override",
    "shift:suspend", "shift:view", "expense:review", "expense:view", "stock:report", "stock:view",
    "incident:resolve", "incident:view", "sale:view", "payment:view", "evidence:view", "notification:view",
  ]),
  MENU_PRICING_ADMIN: new Set(["price:manage", "menu:manage", "menu:view", "hq:read", "hq:view", "config:view"]),
  ANALYST: new Set(["hq:read", "hq:view", "sale:view", "payment:view", "stock:view", "config:view"]),
  AUDITOR: new Set(["hq:read", "hq:view", "audit:read", "audit:view", "hq:export", "sale:view", "payment:view", "expense:view", "evidence:view"]),
  OPERATOR: new Set([
    "shift:start", "shift:close", "shift:handover", "shift:view",
    "location:report", "location:view",
    "sale:create", "sale:void", "sale:view",
    "payment:cash", "payment:digital", "payment:view",
    "expense:submit", "expense:view", "stock:report", "stock:restock-request", "stock:view",
    "incident:submit", "incident:view",
    "loyalty:identify", "loyalty:redeem",
    "price:acknowledge",
    "menu:view",
    "evidence:upload", "evidence:view", "traffic-sample:view", "traffic-sample:create",
    "site-condition:view", "site-condition:create", "notification:view",
  ]),
};

export function authorize(session: SessionContext, action: Action, target: Scope): void {
  // Check organization match
  if (session.organizationId !== target.organizationId) {
    throw Object.assign(new Error(`Forbidden: organization mismatch`), { code: "FORBIDDEN" });
  }
  // Check role permissions
  const allowed = session.roles.some(role => {
    const perms = ROLE_PERMISSIONS[role];
    return perms && perms.has(action);
  });
  if (!allowed) {
    const err = new Error(`Forbidden: role ${session.roles.join(",")} cannot perform ${action}`);
    (err as any).code = "FORBIDDEN";
    throw err;
  }
  // Scope checks: self can only act on self
  if (session.scope.kind === "self") {
    if (target.kind === "self" && target.operatorId !== session.operatorId) {
      const err = new Error("Forbidden: self scope violation");
      (err as any).code = "FORBIDDEN";
      throw err;
    }
  }
  // Area supervisor can only manage their area
  if (session.roles.includes("AREA_SUPERVISOR") && session.scope.areaId) {
    if (target.areaId && target.areaId !== session.scope.areaId) {
      const err = new Error("Forbidden: area scope violation");
      (err as any).code = "FORBIDDEN";
      throw err;
    }
  }
}
