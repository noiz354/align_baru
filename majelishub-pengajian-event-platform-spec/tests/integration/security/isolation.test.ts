/**
 * INTEGRATION TEST - security/isolation.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-SEC-001 · Requirement(s): FR-ORG-003, NFR-SEC-003
 * Specification: ADR-0017, SECURITY.md §4, docs/security/AUTHZ-MATRIX.md §4.1
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Both enforcement layers are proved independently:
 *   layer 2 - the scoped WHERE clause in the repositories (a cross-org id yields zero rows -> 404);
 *   layer 3 - row-level security (an UNSCOPED query inside a scoped transaction still returns only the
 *             current organization's rows, because the session variables and the application role are set).
 *
 * Why these behaviours: seeing another community's participants would end the product's credibility.
 *
 * Delivered 2026-09-27 (T-SEC-001). The route-manifest enumeration ("every scoped endpoint") grows with
 * each slice; today the scoped surface is the organization/mosque repositories.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, expectTypeOf, test } from "vitest";
import "../../support/env";
import { createTestDatabase, TEST_APP_ROLE, type TestDatabase } from "../../support/db";
import { withScopedTransaction } from "@/server/db/client";
import { mosques } from "@/server/db/schema";
import { AppError, ErrorCode } from "@/shared/contracts/errors";
import { organizationScope, platformScope, type TenantScope } from "@/shared/contracts/scope";
import {
  createOrganization,
  findOrganizationById,
  findOrganizationBySlug,
} from "@/server/db/repositories/organizations";
import { createMosque, findMosqueById, findMosqueBySlug, listMosques } from "@/server/db/repositories/mosques";
import { setSecurityEventSink, type SecurityEvent } from "@/server/auth/authorization-events";

const PLATFORM_ACTOR = "00000000-0000-7000-8000-000000000000";

let harness: TestDatabase;
let scopeA: TenantScope;
let scopeB: TenantScope;
let mosqueA: { id: string; slug: string; name: string };
let mosqueB: { id: string; slug: string; name: string };
let recorded: SecurityEvent[] = [];
let restoreSink: (() => void) | undefined;

beforeAll(async () => {
  harness = await createTestDatabase();

  const platform = platformScope(PLATFORM_ACTOR);
  const orgA = await createOrganization(harness.db, platform, { name: "Masjid Al-Ikhlas", slug: "al-ikhlas" });
  const orgB = await createOrganization(harness.db, platform, { name: "Komunitas Darul Ilmi", slug: "darul-ilmi" });

  scopeA = organizationScope(orgA.id);
  scopeB = organizationScope(orgB.id);

  const a = await createMosque(harness.db, scopeA, { name: "Masjid Al-Ikhlas Pusat", slug: "pusat" });
  const b = await createMosque(harness.db, scopeB, { name: "Musholla Darul Ilmi", slug: "pusat" });
  mosqueA = { id: a.id, slug: a.slug, name: a.name };
  mosqueB = { id: b.id, slug: b.slug, name: b.name };

  const previous = setSecurityEventSink((event) => {
    recorded.push(event);
  });
  restoreSink = () => setSecurityEventSink(previous);
});

afterAll(async () => {
  restoreSink?.();
  await harness.close();
});

beforeEach(() => {
  recorded = [];
});

describe("tenant isolation", () => {
  test("returns 404 (not 403) for every cross-organization id, slug and list query", async () => {
    // By id: another tenant's mosque is indistinguishable from one that does not exist.
    await expect(findMosqueById(harness.db, scopeA, mosqueB.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
      httpStatus: 404,
    });
    // By slug: both organizations use the slug "pusat", so the scope decides - never a leak.
    await expect(findMosqueBySlug(harness.db, scopeA, mosqueB.slug)).resolves.toMatchObject({ id: mosqueA.id });
    // The same lookups from the other side.
    await expect(findMosqueById(harness.db, scopeB, mosqueA.id)).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    // Organizations themselves follow the same rule.
    const organizationBId = scopeB.organizationId;
    await expect(findOrganizationById(harness.db, scopeA, organizationBId)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
    await expect(findOrganizationBySlug(harness.db, scopeA, "darul-ilmi")).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
    // The error never confirms existence and never carries the other tenant's identifier.
    const error = await findMosqueById(harness.db, scopeA, mosqueB.id).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AppError);
    expect(JSON.stringify((error as AppError).toShape())).not.toContain(mosqueB.id);
  });

  test("returns zero rows for a cross-organization list request", async () => {
    const forA = await listMosques(harness.db, scopeA);
    const forB = await listMosques(harness.db, scopeB);

    expect(forA.map((row) => row.id)).toEqual([mosqueA.id]);
    expect(forB.map((row) => row.id)).toEqual([mosqueB.id]);
    expect(forA.every((row) => row.organizationId === scopeA.organizationId)).toBe(true);
    expect(forB.every((row) => row.organizationId === scopeB.organizationId)).toBe(true);
  });

  test("proves the second layer: an unscoped query is refused by row-level security", async () => {
    // No WHERE clause at all. Only the session variables + application role protect this query.
    const visibleToA = await withScopedTransaction(
      harness.db,
      scopeA,
      async (tx) => tx.select({ id: mosques.id }).from(mosques),
      { appRole: TEST_APP_ROLE },
    );
    expect(visibleToA.map((row) => row.id)).toEqual([mosqueA.id]);

    // A cross-organization INSERT is refused by the policy's WITH CHECK, not by application code.
    const insertError = await withScopedTransaction(
      harness.db,
      scopeA,
      async (tx) =>
        tx
          .insert(mosques)
          .values({ organizationId: scopeB.organizationId, name: "Penyusup", slug: "penyusup" })
          .returning({ id: mosques.id }),
      { appRole: TEST_APP_ROLE },
    ).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(insertError).not.toBeNull();
    // Drizzle wraps the driver error; the database's own words are on the cause.
    const insertMessage = `${String((insertError as Error).message)} ${String((insertError as { cause?: unknown }).cause)}`;
    expect(insertMessage).toMatch(/row-level security/i);

    // A missing session variable fails closed: zero rows, never "all rows".
    // (Statements run one at a time - the extended protocol rejects multi-command strings - but PGlite
    // is a single session, so the transaction spans the calls.)
    await harness.exec("BEGIN");
    await harness.exec(`SET LOCAL ROLE ${TEST_APP_ROLE}`);
    const unset = await harness.query<{ n: number }>("SELECT count(*)::int AS n FROM mosques");
    await harness.exec("COMMIT");
    expect(unset[0]?.n).toBe(0);
  });

  test("logs an authorization event without object content", async () => {
    await expect(findMosqueById(harness.db, scopeA, mosqueB.id, { actorUserId: "actor-1" })).rejects.toBeInstanceOf(
      AppError,
    );

    expect(recorded).toHaveLength(1);
    const event = recorded[0];
    expect(event).toMatchObject({
      event: "authorization_denied",
      outcome: "DENIED_CROSS_ORGANIZATION",
      actorUserId: "actor-1",
      organizationId: scopeA.organizationId,
      scopeKind: "ORG",
      targetType: "mosque",
    });

    // The refused object's identity and content must not appear anywhere in the event.
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain(mosqueB.id);
    expect(serialized).not.toContain(mosqueB.name);
    expect(serialized).not.toContain(scopeB.organizationId);
  });

  test("cannot express an unscoped repository call (type-level check)", () => {
    // ADR-0017 enforcement: "Repository methods that query scoped tables without a TenantScope
    // parameter ... are caught by a type-level test (expectTypeOf)".
    expectTypeOf(findMosqueById).parameter(1).toEqualTypeOf<TenantScope>();
    expectTypeOf(findMosqueBySlug).parameter(1).toEqualTypeOf<TenantScope>();
    expectTypeOf(listMosques).parameter(1).toEqualTypeOf<TenantScope>();
    expectTypeOf(createMosque).parameter(1).toEqualTypeOf<TenantScope>();
    expectTypeOf(findOrganizationById).parameter(1).toEqualTypeOf<TenantScope>();
    expectTypeOf(createOrganization).parameter(1).toEqualTypeOf<TenantScope>();

    // The scope parameter is required, not optional: a call without it does not compile.
    expectTypeOf<Parameters<typeof listMosques>>().toMatchTypeOf<[unknown, TenantScope]>();
  });
});
