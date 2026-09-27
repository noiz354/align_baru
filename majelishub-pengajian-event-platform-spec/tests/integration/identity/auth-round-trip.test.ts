/**
 * INTEGRATION TEST - identity/auth-round-trip.test.ts
 * Layer: integration · Owning task: T-ORG-001 · Requirement(s): NFR-SEC-001, FR-ORG-001, NFR-SEC-011
 * Specification: ADR-0005 (Better Auth, sessions in OUR PostgreSQL), ADR-0006, SECURITY.md §2 (session
 *   cookies, revocation) and §9 (no plaintext credentials at rest), §13 (no in-memory rate limiting),
 *   API.md (auth endpoints), DATA_MODEL.md §1 (identity tables)
 *
 * Everything here runs against a REAL PostgreSQL 18 with the project's own migrations applied (PGlite
 * in-process by default, or `INTEGRATION_DATABASE_URL` in CI), through the production `createAuth`
 * configuration and the same `handler(request)` call the mounted route makes.
 *
 * Proven:
 *   1. `POST /api/auth/sign-up/email` writes real `users`, `accounts` and `sessions` rows in our schema
 *      and answers with a session cookie carrying the documented attributes.
 *   2. The password is stored as a salted hash, never as the submitted value (SECURITY.md §9).
 *   3. `getSession()` with that cookie reads the session back: the sign-in -> session round trip.
 *   4. A wrong password is refused with 401 and creates no session row.
 *   5. Sign-out deletes the session row - revocation is durable state, not a library-side flag.
 *   6. OUR durable rate-limit storage (`rate_limit_buckets`) is what the library writes to, and it
 *      answers 429; the mount adds the standard `Retry-After` header (src/server/http/auth-response.ts).
 *   7. The adapter's table mirror has exactly the columns of the migrated schema, so the field mappings
 *      in `createAuth` cannot drift away from the database.
 *
 * The identity store is injected as a Drizzle adapter (ARCHITECTURE.md §5: the store is a port) because
 * the production path hands Better Auth a `pg` pool; both go through the same configuration, the same
 * model/field mappings and the same SQL dialect.
 *
 * Failure cases exercised: wrong password (401) · unknown cookie (null) · rate limit reached (429).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getTableColumns } from "drizzle-orm";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { identityAdapterSchema } from "../../support/identity-adapter-schema";
import { createAuth } from "@/server/auth/auth";
import { createDurableAuthRateLimitStorage } from "@/server/auth/rate-limit";
import { config } from "@/server/config";
import { withStandardRateLimitHeader } from "@/server/http/auth-response";
import { accounts, sessions, users, verifications } from "@/server/db/schema";

const BASE_URL = "http://localhost:3000";
const EMAIL = "pengurus@masjid-contoh.test";
const PASSWORD = "kajian-aman-2026";

let harness: TestDatabase;
let authInstance: ReturnType<typeof createAuth>;

beforeAll(async () => {
  harness = await createTestDatabase();
  authInstance = createAuth({
    config: config(),
    // Real PostgreSQL, real migrations, real rows - through Drizzle instead of a raw `pg` pool.
    database: drizzleAdapter(harness.db, {
      provider: "pg",
      // The mirror's property names already equal the column names, so no casing option is needed.
      schema: identityAdapterSchema,
    }),
    // Rate limiting uses the same durable store production uses.
    rateLimitStorage: createDurableAuthRateLimitStorage(harness.db),
  });
});

afterAll(async () => {
  await harness.close();
});

/** Calls the mounted handler exactly as `src/app/api/auth/[...all]/route.ts` does. */
function call(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.cookie) headers["cookie"] = init.cookie;
  // `exactOptionalPropertyTypes` forbids an explicit `body: undefined`, so the init is built in steps.
  const request: RequestInit = { method: init.method ?? "POST", headers };
  if (init.body !== undefined) request.body = JSON.stringify(init.body);
  return authInstance.handler(new Request(`${BASE_URL}/api/auth${path}`, request));
}

function sessionCookie(response: Response): string {
  const raw = response.headers.getSetCookie().find((cookie) => cookie.startsWith("better-auth.session_token="));
  expect(raw, `no session cookie in ${JSON.stringify(response.headers.getSetCookie())}`).toBeDefined();
  const pair = raw?.split(";")[0];
  expect(pair).toBeDefined();
  return pair as string;
}

interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
}
interface SessionRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
}
interface AccountRow {
  id: string;
  user_id: string;
  provider_id: string;
  password: string | null;
}

describe("identity round trip", () => {
  let cookie: string;

  test("the adapter mirror has exactly the columns of the migrated identity schema", () => {
    const columnsOf = (table: unknown): string[] =>
      Object.values(getTableColumns(table as Parameters<typeof getTableColumns>[0]))
        .map((column) => column.name)
        .sort();
    expect(columnsOf(identityAdapterSchema.users)).toEqual(columnsOf(users));
    expect(columnsOf(identityAdapterSchema.sessions)).toEqual(columnsOf(sessions));
    expect(columnsOf(identityAdapterSchema.accounts)).toEqual(columnsOf(accounts));
    expect(columnsOf(identityAdapterSchema.verifications)).toEqual(columnsOf(verifications));
  });

  test("sign-up writes real user, account and session rows and returns a documented cookie", async () => {
    const response = await call("/sign-up/email", {
      body: { email: EMAIL, password: PASSWORD, name: "Pengurus Masjid" },
    });
    expect(response.status, await response.clone().text()).toBe(200);
    cookie = sessionCookie(response);

    const raw = response.headers.getSetCookie().find((entry) => entry.startsWith("better-auth.session_token=")) ?? "";
    // SECURITY.md §2: the cookie is never readable by scripts and never sent cross-site.
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    // `Secure` is tied to the environment (src/server/auth/auth.ts); this suite runs with NODE_ENV=test.
    expect(config().nodeEnv).toBe("test");
    expect(/Secure/i.test(raw)).toBe(false);

    // The rows are in OUR database, with OUR columns (DATA_MODEL.md §1).
    const rows = await harness.query<UserRow>("SELECT id, email, email_verified, created_at FROM users");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(EMAIL);
    // The schema forces lowercase addresses; the value that arrived was already lowercase.
    expect(rows[0]?.email).toBe(rows[0]?.email.toLowerCase());
    expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(rows[0]?.created_at).toBeInstanceOf(Date);

    const accountRows = await harness.query<AccountRow>(
      "SELECT id, user_id, provider_id, password FROM accounts",
    );
    expect(accountRows).toHaveLength(1);
    expect(accountRows[0]?.provider_id).toBe("credential");
    expect(accountRows[0]?.user_id).toBe(rows[0]?.id);
    // SECURITY.md §9: never the submitted password, and salted (salt:hash).
    expect(accountRows[0]?.password).not.toBeNull();
    expect(accountRows[0]?.password).not.toContain(PASSWORD);
    expect(accountRows[0]?.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);

    const sessionRows = await harness.query<SessionRow>(
      "SELECT id, user_id, token, expires_at FROM sessions",
    );
    expect(sessionRows).toHaveLength(1);
    expect(sessionRows[0]?.user_id).toBe(rows[0]?.id);
    // The cookie carries `<token>.<signature>`; only the token part is stored (ADR-0005).
    expect(cookie.startsWith(`better-auth.session_token=${sessionRows[0]?.token}.`)).toBe(true);
    // SECURITY.md §2: participants hold long-lived sessions (30 days), organizers are re-authenticated
    // after the shorter idle window; the stored expiry is the long one.
    const lifetimeDays = ((sessionRows[0]?.expires_at.getTime() ?? Date.now()) - Date.now()) / 86_400_000;
    expect(lifetimeDays).toBeGreaterThan(25);
  });

  test("getSession() with that cookie returns the same session", async () => {
    const session = await authInstance.api.getSession({ headers: { cookie } });
    expect(session).not.toBeNull();
    expect(session?.user.email).toBe(EMAIL);
    const rows = await harness.query<UserRow>("SELECT id, email, email_verified, created_at FROM users");
    expect(session?.session.userId).toBe(rows[0]?.id);
    // No credential material is echoed back (SECURITY.md §11).
    expect(JSON.stringify(session)).not.toContain(PASSWORD);
  });

  test("a wrong password is refused with 401 and creates no session row", async () => {
    const before = await harness.query<{ n: string }>("SELECT count(*)::text AS n FROM sessions");
    const response = await call("/sign-in/email", { body: { email: EMAIL, password: "salah-sekali-2026" } });
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().some((entry) => entry.startsWith("better-auth.session_token="))).toBe(false);
    const after = await harness.query<{ n: string }>("SELECT count(*)::text AS n FROM sessions");
    expect(after[0]?.n).toBe(before[0]?.n);
    // The existing session is untouched by a failed attempt.
    expect(await authInstance.api.getSession({ headers: { cookie } })).not.toBeNull();
  });

  test("sign-out deletes the session row (durable revocation)", async () => {
    const response = await call("/sign-out", { method: "POST", cookie });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await authInstance.api.getSession({ headers: { cookie } })).toBeNull();
    const rows = await harness.query<{ n: string }>("SELECT count(*)::text AS n FROM sessions");
    expect(rows[0]?.n).toBe("0");
  });

  test("an unknown session cookie yields no session, never a default identity", async () => {
    expect(
      await authInstance.api.getSession({ headers: { cookie: "better-auth.session_token=bukan-sesi-asli" } }),
    ).toBeNull();
  });

  test("sign-in attempts are limited by our durable Postgres store, with Retry-After", async () => {
    let limited: Response | undefined;
    for (let attempt = 0; attempt < 10 && limited === undefined; attempt += 1) {
      const response = await call("/sign-in/email", { body: { email: EMAIL, password: "salah-sekali-2026" } });
      if (response.status === 429) limited = withStandardRateLimitHeader(response);
    }
    expect(limited, "the durable limiter never refused").toBeDefined();
    // API.md §1: 429 carries the standard Retry-After (seconds); the library's own header is kept.
    expect(limited?.status).toBe(429);
    const retryAfter = Number.parseInt(limited?.headers.get("retry-after") ?? "", 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(limited?.headers.get("x-retry-after")).not.toBeNull();

    const buckets = await harness.query<{ bucket_key: string; hits: number }>(
      "SELECT bucket_key, hits FROM rate_limit_buckets ORDER BY bucket_key",
    );
    expect(buckets.length).toBeGreaterThan(0);
    for (const bucket of buckets) {
      // SECURITY.md §11: no raw IP, contact value or token in a stored key.
      expect(bucket.bucket_key.startsWith("rl:auth-lib:")).toBe(true);
      expect(bucket.bucket_key).not.toContain(EMAIL);
      expect(bucket.hits).toBeGreaterThan(0);
    }
  });

  test("the normaliser leaves responses it should not touch alone", () => {
    // Not a 429: untouched.
    const ok = new Response("ok", { status: 200 });
    expect(withStandardRateLimitHeader(ok)).toBe(ok);

    // A 429 without any delay information: untouched (never invent a delay).
    const bare = new Response("slow down", { status: 429 });
    expect(withStandardRateLimitHeader(bare)).toBe(bare);

    // A non-numeric delay: untouched.
    const broken = new Response("slow down", { status: 429, headers: { "x-retry-after": "segera" } });
    expect(withStandardRateLimitHeader(broken)).toBe(broken);

    // Already standard: untouched.
    const standard = new Response("slow down", { status: 429, headers: { "retry-after": "30" } });
    expect(withStandardRateLimitHeader(standard)).toBe(standard);

    // The case the library actually produces.
    const fromLibrary = new Response("slow down", { status: 429, headers: { "x-retry-after": "752" } });
    const normalised = withStandardRateLimitHeader(fromLibrary);
    expect(normalised.headers.get("retry-after")).toBe("752");
    expect(normalised.headers.get("x-retry-after")).toBe("752");
  });
});
