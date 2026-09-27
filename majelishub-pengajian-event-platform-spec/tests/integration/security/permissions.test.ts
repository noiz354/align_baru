/**
 * INTEGRATION TEST - security/permissions.test.ts
 * Layer: integration · Owning task: T-SEC-002 · Requirement(s): FR-ORG-002, NFR-SEC-002, NFR-SEC-001
 * Specification: docs/security/AUTHZ-MATRIX.md (matrix + §4 rules + §5 verification), SECURITY.md §3/§4
 *
 * The matrix is only real if every cell is executed, so the first test walks all 9 roles x all 53
 * permission keys and asserts the documented outcome for each one. The last test is the static check
 * AUTHZ-MATRIX §5 asks for: no route may perform a protected action without going through
 * `requirePermission`, unless it is listed - with a reason - in `src/server/auth/public-routes.ts`.
 *
 * Delivered 2026-09-27 (T-SEC-002).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import "../../support/env";
import {
  AUTHORIZATION_MATRIX,
  NON_DELEGABLE_ROLES,
  allPermissionKeys,
  assertCanGrantRoles,
  permissionsForRole,
  requirePermission,
  type Grant,
} from "@/server/auth/permissions";
import { PUBLIC_ROUTES } from "@/server/auth/public-routes";
import {
  PERMISSION_KEYS,
  REASON_REQUIRED_PERMISSIONS,
  ROLE_KEYS,
  type Actor,
  type PermissionKey,
  type RoleKey,
} from "@/shared/contracts/permissions";
import { organizationScope, platformScope } from "@/shared/contracts/scope";
import { AppError, ErrorCode } from "@/shared/contracts/errors";
import { setSecurityEventSink, type SecurityEvent } from "@/server/auth/authorization-events";

const ORG = "11111111-1111-7111-8111-111111111111";
const MOSQUE = "33333333-3333-7333-8333-333333333333";
const EVENT = "55555555-5555-7555-8555-555555555555";
const OTHER_ORG = "22222222-2222-7222-8222-222222222222";
const REASON = "Alasan tercatat untuk audit";

let recorded: SecurityEvent[] = [];
let restoreSink: (() => void) | undefined;

// The matrix walk and the guard are pure: scope derivation against a real database is covered by
// tests/integration/security/session-scope.test.ts, so this suite needs no database of its own.
beforeAll(() => {
  const previous = setSecurityEventSink((event) => {
    recorded.push(event);
  });
  restoreSink = () => setSecurityEventSink(previous);
});

afterAll(() => {
  restoreSink?.();
});

function actorFor(role: RoleKey, userId = `user-${role.toLowerCase()}`): Actor {
  const scope = role === "PLATFORM_ADMIN" ? platformScope(ORG) : organizationScope(ORG);
  return { userId, roles: [role], scope };
}

function resourceFor(userId: string) {
  return { organizationId: ORG, mosqueId: MOSQUE, eventId: EVENT, ownerId: userId };
}

function expectDenied(fn: () => void, code: ErrorCode): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught, "expected a denial").toBeInstanceOf(AppError);
  expect((caught as AppError).code).toBe(code);
}

describe("permission matrix", () => {
  test("covers every permission key exactly once, and no key that does not exist", () => {
    const keys = allPermissionKeys();
    expect(new Set(keys).size, "no duplicate matrix rows").toBe(keys.length);
    // Both directions: no contract key without a row (silent DENY by omission), no row without a key.
    expect(keys.filter((key) => !PERMISSION_KEYS.includes(key))).toEqual([]);
    expect(PERMISSION_KEYS.filter((key) => !keys.includes(key))).toEqual([]);
    // Every reason-required key is reachable by somebody, otherwise the rule is untestable dead weight.
    for (const key of REASON_REQUIRED_PERMISSIONS) {
      expect(ROLE_KEYS.some((role) => permissionsForRole(role).includes(key)), `${key} held by no role`).toBe(true);
    }
  });

  test("walks every role x permission cell and asserts the documented outcome", () => {
    let cells = 0;
    for (const row of AUTHORIZATION_MATRIX) {
      for (const role of ROLE_KEYS) {
        cells += 1;
        const grant: Grant | undefined = row.grants[role];
        const actor = actorFor(role);
        const resource = resourceFor(actor.userId);

        if (grant === undefined) {
          expectDenied(
            () => requirePermission({ actor, permission: row.key, scopeKind: actor.scope.kind, resource }),
            ErrorCode.FORBIDDEN,
          );
          continue;
        }

        if (grant === "ALLOW") {
          expect(() =>
            requirePermission({ actor, permission: row.key, scopeKind: actor.scope.kind, resource, reason: REASON }),
          ).not.toThrow();
          continue;
        }

        if (grant === "ALLOW_WITH_REASON") {
          expectDenied(
            () => requirePermission({ actor, permission: row.key, scopeKind: actor.scope.kind, resource }),
            ErrorCode.VALIDATION_FAILED,
          );
          expect(() =>
            requirePermission({ actor, permission: row.key, scopeKind: actor.scope.kind, resource, reason: REASON }),
          ).not.toThrow();
          continue;
        }

        if (grant === "ALLOW_OWN") {
          // Own record: allowed. Somebody else's record: refused.
          expect(() =>
            requirePermission({ actor, permission: row.key, scopeKind: "OWN", resource, reason: REASON }),
          ).not.toThrow();
          expectDenied(
            () =>
              requirePermission({
                actor,
                permission: row.key,
                scopeKind: "OWN",
                resource: { ...resource, ownerId: "somebody-else" },
                reason: REASON,
              }),
            ErrorCode.FORBIDDEN,
          );
          continue;
        }

        if (grant === "ALLOW_DEVICE_BOUND") {
          expectDenied(
            () => requirePermission({ actor, permission: row.key, scopeKind: actor.scope.kind, resource }),
            ErrorCode.FORBIDDEN,
          );
          expect(() =>
            requirePermission({
              actor,
              permission: row.key,
              scopeKind: actor.scope.kind,
              resource,
              deviceBinding: { eventId: EVENT },
            }),
          ).not.toThrow();
        }
      }
    }
    expect(cells).toBe(AUTHORIZATION_MATRIX.length * ROLE_KEYS.length);
  });

  test("requires a stored reason for every reason-required permission", () => {
    expect(REASON_REQUIRED_PERMISSIONS.length).toBeGreaterThan(0);
    for (const permission of REASON_REQUIRED_PERMISSIONS) {
      // Find a role that holds it, then prove the reason is mandatory for that role.
      const holder = ROLE_KEYS.find((role) => permissionsForRole(role).includes(permission));
      expect(holder, `${permission} must be held by at least one role`).toBeDefined();
      if (!holder) continue;
      const actor = actorFor(holder);
      const context = {
        actor,
        permission,
        scopeKind: actor.scope.kind,
        resource: resourceFor(actor.userId),
      } as const;

      expectDenied(() => requirePermission(context), ErrorCode.VALIDATION_FAILED);
      expectDenied(() => requirePermission({ ...context, reason: "pendek" }), ErrorCode.VALIDATION_FAILED);

      recorded = [];
      expect(() => requirePermission({ ...context, reason: REASON })).not.toThrow();
      // The reason is part of the record (SECURITY.md §12).
      const entry = recorded.find((event) => event.event === "authorization_reason_recorded");
      expect(entry).toBeDefined();
      expect(entry).toMatchObject({ permission, reason: REASON, actorUserId: actor.userId });
    }
  });

  test("refuses self-approval (separation of duties) and self-escalation", () => {
    const reviewer = actorFor("TRANSCRIPT_REVIEWER", "reviewer-1");
    const resource = resourceFor("reviewer-1");

    // Approving somebody else's revision is allowed with a reason; approving your own is not.
    expect(() =>
      requirePermission({
        actor: reviewer,
        permission: "transcript.approve",
        scopeKind: reviewer.scope.kind,
        resource,
        subjectOwnerId: "editor-2",
        reason: REASON,
      }),
    ).not.toThrow();

    recorded = [];
    expectDenied(
      () =>
        requirePermission({
          actor: reviewer,
          permission: "transcript.approve",
          scopeKind: reviewer.scope.kind,
          resource,
          subjectOwnerId: "reviewer-1",
          reason: REASON,
        }),
      ErrorCode.FORBIDDEN,
    );
    expect(recorded.some((event) => event.event === "authorization_denied")).toBe(true);

    // Self-escalation: granting yourself a role, granting a role you do not hold, or granting a
    // platform-trust role are all refused.
    const organizer = actorFor("ORGANIZER", "organizer-1");
    expect(() =>
      assertCanGrantRoles(organizer.roles, ["ORGANIZER"], "organizer-1", "colleague-2", {
        organizationId: ORG,
        scopeKind: "ORG",
      }),
    ).not.toThrow();

    expect(() =>
      assertCanGrantRoles(organizer.roles, ["ORGANIZER"], "organizer-1", "organizer-1", {
        organizationId: ORG,
        scopeKind: "ORG",
      }),
    ).toThrow(AppError);
    expect(() =>
      assertCanGrantRoles(organizer.roles, ["VOLUNTEER"], "organizer-1", "colleague-2", {
        organizationId: ORG,
        scopeKind: "ORG",
      }),
    ).toThrow(AppError);
    for (const role of NON_DELEGABLE_ROLES) {
      expect(() =>
        assertCanGrantRoles(["PLATFORM_ADMIN"], [role], "admin-1", "colleague-2", {
          organizationId: ORG,
          scopeKind: "PLATFORM",
        }),
      ).toThrow(AppError);
    }
  });

  test("a cross-organization resource is NOT_FOUND, and an unknown key fails closed", () => {
    const actor = actorFor("ORGANIZER");
    expectDenied(
      () =>
        requirePermission({
          actor,
          permission: "event.read",
          scopeKind: actor.scope.kind,
          resource: { organizationId: OTHER_ORG },
        }),
      ErrorCode.NOT_FOUND,
    );

    recorded = [];
    expectDenied(
      () =>
        requirePermission({
          actor,
          permission: "does.not.exist" as PermissionKey,
          scopeKind: actor.scope.kind,
          resource: resourceFor(actor.userId),
        }),
      ErrorCode.FORBIDDEN,
    );
    expect(
      recorded.some(
        (event) => event.event === "authorization_denied" && event.outcome === "DENIED_UNKNOWN_PERMISSION",
      ),
    ).toBe(true);

    // No roles at all: denied, never defaulted.
    expectDenied(
      () =>
        requirePermission({
          actor: { userId: "user-x", roles: [], scope: organizationScope(ORG) },
          permission: "event.read",
          scopeKind: "ORG",
          resource: resourceFor("user-x"),
        }),
      ErrorCode.FORBIDDEN,
    );
  });

  test("proves by static analysis that no protected action skips requirePermission", () => {
    const appRoot = join(process.cwd(), "src", "app");
    const apiRoot = join(appRoot, "api");
    const routeFiles = listRouteFiles(apiRoot);
    expect(routeFiles.length).toBe(26);

    const taskIds = new Set(
      Array.from(readFileSync(join(process.cwd(), "TASKS.md"), "utf8").matchAll(/\bT-[A-Z]+-\d{3}\b/g), (m) => m[0]),
    );
    expect(taskIds.size).toBeGreaterThan(0);

    const unprotected: string[] = [];
    const stubs: string[] = [];
    for (const file of routeFiles) {
      const source = readFileSync(file, "utf8");
      const routePath = `/${relative(appRoot, file).replace(/\/route\.ts$/, "")}`;
      const authorized = source.includes("requirePermission(");
      const listed = PUBLIC_ROUTES.some((route) => route.path === routePath);

      // A shell that performs no action is not "protected" yet - but it is only allowed to stay that
      // way while every handler is a bare `Not implemented: <real TASKS.md id>` throw with no data
      // access imported. The moment it does something, `requirePermission` becomes mandatory.
      const classification = classifyRoute(source);
      if (authorized || listed) continue;
      if (classification.kind === "stub") {
        for (const id of classification.taskIds) {
          expect(taskIds.has(id), `${routePath} cites an unknown task id ${id}`).toBe(true);
        }
        stubs.push(routePath);
        continue;
      }
      unprotected.push(routePath);
    }

    expect(
      unprotected,
      `routes that act on data without requirePermission and are not listed as public: ${unprotected.join(", ")}`,
    ).toEqual([]);

    // Progress is visible: these shells must shrink as their owning tasks land.
    expect(stubs.length).toBe(24);

    // The public list must not rot: every entry has a real route behind it, with a stated reason.
    for (const route of PUBLIC_ROUTES) {
      const file = join(appRoot, ...route.path.split("/"), "route.ts");
      expect(statSync(file).isFile(), `public route has no handler: ${route.path}`).toBe(true);
      expect(route.reason.length).toBeGreaterThan(10);
    }
  });
});

/** Imports that would let a route touch tenant data, i.e. make it a protected surface. */
const DATA_IMPORTS = ["@/server/db", "@/server/features", "@/server/services", "@/features", "@/server/auth/"];

type RouteClassification =
  | { readonly kind: "acts" }
  | { readonly kind: "stub"; readonly taskIds: readonly string[] };

function classifyRoute(source: string): RouteClassification {
  const handlers = handlerBodies(source);
  if (handlers.length === 0) return { kind: "acts" };
  const touchingData = DATA_IMPORTS.some((path) => source.includes(`from "${path}`));
  if (touchingData) return { kind: "acts" };
  const stubPattern = /^throw new Error\("Not implemented: (T-[A-Z]+-\d{3})"\);$/;
  const taskIds: string[] = [];
  for (const body of handlers) {
    const match = stubPattern.exec(body.trim());
    if (!match || !match[1]) return { kind: "acts" };
    taskIds.push(match[1]);
  }
  return { kind: "stub", taskIds };
}

/** Bodies of every exported HTTP handler (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS) in a route file. */
function handlerBodies(source: string): string[] {
  const bodies: string[] = [];
  const declaration = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source)) !== null) {
    const open = source.indexOf("{", declaration.lastIndex);
    if (open === -1) return [];
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(source.slice(open + 1, i));
          break;
        }
      }
    }
  }
  return bodies;
}

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}
