/**
 * INTEGRATION TEST - identity/auth-round-trip.test.ts
 * Layer: integration · Owning task: T-ORG-001 · Requirement(s): NFR-SEC-001, FR-ORG-001, NFR-SEC-011
 * Specification: ADR-0005 (Better Auth, in-app), SECURITY.md §2 (session cookies) and §13 (no
 *   in-memory rate limiting), API.md (auth endpoints), FR-ORG-001 (sign-in for organizers)
 *
 * What this proves, through the same `createAuth` configuration production uses and through the same
 * `handler(request)` call the mounted route makes:
 *   1. `POST /api/auth/sign-up/email` creates an account and answers with a session cookie carrying the
 *      documented attributes (HttpOnly, SameSite=Lax; Secure in production only - SECURITY.md §2).
 *   2. `getSession()` with that cookie returns the same session: the sign-in -> session round trip.
 *   3. A wrong password is refused with 401 and issues no session cookie.
 *   4. Sign-out ends the session: `getSession()` returns null afterwards.
 *   5. OUR durable rate-limit storage (Postgres, `rate_limit_buckets`) is the one being written to, and
 *      after the configured number of attempts the library answers 429 with `Retry-After` - the
 *      library's in-memory limiter is never used (SECURITY.md §13).
 *
 * What it does NOT cover, stated plainly: the identity rows themselves are written to Postgres in
 * production (`database: getPool()` in `src/server/auth/auth.ts`). This suite injects the library's
 * memory adapter because `@better-auth/drizzle-adapter` resolves Better Auth's mapped field names
 * against Drizzle table *properties*, which conflicts with the snake_case column mappings the `pg` pool
 * adapter requires; wiring the two together is a recorded follow-up in TASKS.md T-ORG-001. Session and
 * user rows in Postgres - including revocation by deleting the row - are covered by
 * tests/integration/security/session-revocation.test.ts and session-scope.test.ts.
 *
 * Failure cases exercised: wrong password (401) · unknown cookie (null) · rate limit reached (429).
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { memoryAdapter } from "@better-auth/memory-adapter";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { createAuth } from "@/server/auth/auth";
import { createDurableAuthRateLimitStorage } from "@/server/auth/rate-limit";
import { config } from "@/server/config";
import { withStandardRateLimitHeader } from "@/server/http/auth-response";

const BASE_URL = "http://localhost:3000";
const EMAIL = "pengurus@masjid-contoh.test";
const PASSWORD = "kajian-aman-2026";

let harness: TestDatabase;
let authInstance: ReturnType<typeof createAuth>;

beforeAll(async () => {
  harness = await createTestDatabase();
  authInstance = createAuth({
    config: config(),
    // Identity store: see the file header. Everything else is the production configuration.
    database: memoryAdapter({ users: [], sessions: [], accounts: [], verifications: [] }),
    // Rate limiting always goes to the real database, exactly as in production.
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

describe("identity round trip", () => {
  let cookie: string;

  test("sign-up through the mounted handler answers with a documented session cookie", async () => {
    const response = await call("/sign-up/email", {
      body: { email: EMAIL, password: PASSWORD, name: "Pengurus Masjid" },
    });
    expect(response.status, await response.clone().text()).toBe(200);
    cookie = sessionCookie(response);

    const raw = response.headers.getSetCookie().find((entry) => entry.startsWith("better-auth.session_token=")) ?? "";
    // SECURITY.md §2: the cookie is never readable by scripts and never sent cross-site.
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    // `Secure` is tied to the environment (src/server/auth/auth.ts): this suite runs with NODE_ENV=test.
    expect(config().nodeEnv).toBe("test");
    expect(/Secure/i.test(raw)).toBe(false);

    const body = (await response.json()) as { user?: { email?: string }; token?: string };
    expect(body.user?.email).toBe(EMAIL);
    expect(body.token).toBeDefined();
  });

  test("getSession() with that cookie returns the same session", async () => {
    const session = await authInstance.api.getSession({ headers: { cookie } });
    expect(session).not.toBeNull();
    expect(session?.user.email).toBe(EMAIL);
    expect(session?.session.userId).toBeDefined();
    // No credential material is echoed back (SECURITY.md §11).
    expect(JSON.stringify(session)).not.toContain(PASSWORD);
  });

  test("a wrong password is refused and issues no session cookie", async () => {
    const response = await call("/sign-in/email", { body: { email: EMAIL, password: "salah-sekali-2026" } });
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie().some((entry) => entry.startsWith("better-auth.session_token="))).toBe(false);
    expect(await authInstance.api.getSession({ headers: { cookie } })).not.toBeNull();
  });

  test("sign-out ends the session", async () => {
    const response = await call("/sign-out", { method: "POST", cookie });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await authInstance.api.getSession({ headers: { cookie } })).toBeNull();
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
