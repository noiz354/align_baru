/**
 * INTEGRATION TEST - security/session-scope.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-SEC-001 · Requirement(s): FR-ORG-002/003/005, NFR-SEC-003
 * Specification: SECURITY.md §3 (scope resolution), ADR-0017 layer 1, docs/security/AUTHZ-MATRIX.md §4.1
 *
 * The scope is derived from the principal and their memberships - never from request input. These tests
 * pin the rules that keep a volunteer at their own mosque and keep a person without a membership from
 * getting a default scope.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { users } from "@/server/db/schema";
import {
  createMembership,
  createOrganization,
} from "@/server/db/repositories/organizations";
import { deriveScope } from "@/server/auth/permissions";
import { platformScope } from "@/shared/contracts/scope";
import { ErrorCode } from "@/shared/contracts/errors";

const PLATFORM_ACTOR = "00000000-0000-7000-8000-000000000000";
const MOSQUE_A1 = "33333333-3333-7333-8333-333333333333";
const MOSQUE_A2 = "44444444-4444-7444-8444-444444444444";

let harness: TestDatabase;
let orgA: string;
let orgB: string;

beforeAll(async () => {
  harness = await createTestDatabase();
  const platform = platformScope(PLATFORM_ACTOR);
  orgA = (await createOrganization(harness.db, platform, { name: "Masjid Al-Ikhlas", slug: "al-ikhlas" })).id;
  orgB = (await createOrganization(harness.db, platform, { name: "Komunitas Darul Ilmi", slug: "darul-ilmi" })).id;

  await harness.db.insert(users).values([
    { id: "user-organizer", name: "Panitia", email: "panitia@example.test" },
    { id: "user-volunteer", name: "Relawan", email: "relawan@example.test" },
    { id: "user-admin", name: "Platform", email: "platform@example.test" },
    { id: "user-two-orgs", name: "Dua Organisasi", email: "dua@example.test" },
    { id: "user-stranger", name: "Tanpa Anggota", email: "asing@example.test" },
  ]);

  const platform2 = platformScope(orgA);
  await createMembership(harness.db, platform2, { organizationId: orgA, userId: "user-organizer", roles: ["ORGANIZER"] });
  await createMembership(harness.db, platform2, {
    organizationId: orgA,
    userId: "user-volunteer",
    roles: ["VOLUNTEER"],
    mosqueIds: [MOSQUE_A1],
  });
  await createMembership(harness.db, platform2, {
    organizationId: orgA,
    userId: "user-admin",
    roles: ["PLATFORM_ADMIN"],
  });
  await createMembership(harness.db, platform2, { organizationId: orgA, userId: "user-two-orgs", roles: ["ORGANIZER"] });
  await createMembership(harness.db, platformScope(orgB), {
    organizationId: orgB,
    userId: "user-two-orgs",
    roles: ["VOLUNTEER"],
  });
});

afterAll(async () => {
  await harness.close();
});

describe("deriveScope", () => {
  test("an unscoped membership yields an ORG scope for that organization", async () => {
    const scope = await deriveScope(harness.db, { userId: "user-organizer", organizationId: orgA });
    expect(scope).toEqual({ kind: "ORG", organizationId: orgA });
  });

  test("a membership limited to one mosque yields a MOSQUE scope (FR-ORG-005)", async () => {
    const scope = await deriveScope(harness.db, { userId: "user-volunteer", organizationId: orgA });
    expect(scope).toEqual({ kind: "MOSQUE", organizationId: orgA, mosqueId: MOSQUE_A1 });
  });

  test("a mosque-scoped member cannot select a mosque outside their subset", async () => {
    await expect(
      deriveScope(harness.db, { userId: "user-volunteer", organizationId: orgA, mosqueId: MOSQUE_A2 }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  test("PLATFORM_ADMIN yields a PLATFORM scope that still names a home organization", async () => {
    const scope = await deriveScope(harness.db, { userId: "user-admin", organizationId: orgA });
    expect(scope.kind).toBe("PLATFORM");
    expect(scope.organizationId).toBe(orgA);
  });

  test("a member of two organizations must choose; we never guess", async () => {
    await expect(deriveScope(harness.db, { userId: "user-two-orgs" })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    const explicit = await deriveScope(harness.db, { userId: "user-two-orgs", organizationId: orgB });
    expect(explicit).toEqual({ kind: "ORG", organizationId: orgB });
  });

  test("a user with a single membership needs no selection", async () => {
    const scope = await deriveScope(harness.db, { userId: "user-organizer" });
    expect(scope).toEqual({ kind: "ORG", organizationId: orgA });
  });

  test("no membership means no scope - never a default, never all organizations", async () => {
    await expect(deriveScope(harness.db, { userId: "user-stranger" })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
    await expect(deriveScope(harness.db, { userId: "user-stranger", organizationId: orgA })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  test("a missing principal is unauthenticated, not authorized", async () => {
    await expect(deriveScope(harness.db, { userId: "" })).rejects.toMatchObject({ code: ErrorCode.UNAUTHENTICATED });
  });

  test("selecting an organization the user does not belong to is refused", async () => {
    await expect(deriveScope(harness.db, { userId: "user-organizer", organizationId: orgB })).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
