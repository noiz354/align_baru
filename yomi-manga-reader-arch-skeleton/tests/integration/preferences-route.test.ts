/**
 * The preferences route (INT-PREF-ROUTE, F-013-S1/S2).
 *
 * What this pins
 * --------------
 * The route is SELF-SCOPED: it touches the caller's own row and nothing else,
 * which is the whole reason it may ship while the route guard is deferred. The
 * tests that matter here are the ones that would catch the scope breaking:
 * - no session → 401 on both methods, and the service is never called;
 * - the acting user is the session's — a body naming another user is ignored,
 *   because there is no field for it to land in;
 * - a PUT body that is not an object, or a field with the wrong shape, is 422
 *   with the field named — the service owns the rules, the route owns the
 *   transport, and a 422 that loses the field name is the transport failing.
 *
 * The service here is a fake shaped exactly like the port (no casts: the linter
 * forbids them, and a cast would hide the wiring this suite exists to check).
 * Validation itself is the service's, covered in preference-service.test.ts.
 *
 * Requirements: THREAT T-04, API_CONTRACT §1, ERROR_MODEL §4
 * Tasks: F-013-S1/S2
 *
 * No DSN required.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPreferencesHandler } from '../../src/app/api/preferences/route';
import type { ApiDeps } from '../../src/app/api/_deps';
import type { Caller } from '../../src/shared/contracts';
import type { UserId } from '../../src/shared/types';
import { silentLogger } from './support/pg-catalog-ports';

const CALLER: Caller = { userId: 'u-1' as UserId, role: 'reader' };
const OTHER: Caller = { userId: 'u-2' as UserId, role: 'reader' };

// Typed as the contract, not inferred: string literals widen to `string`
// without it, and the suite would then prove nothing about the shapes the
// route actually passes through.
import type { ReaderPreference } from '../../src/shared/contracts/reader';
const STORED: ReaderPreference = {
  defaultMode: 'single',
  directionOverride: 'none',
  zoomDefault: 1.5,
  autoNextChapter: false,
};

function makeDeps(caller: Caller | null = CALLER) {
  const get = vi.fn(async () => ({ ...STORED }));
  const put = vi.fn(async (_caller: unknown, patch: unknown) => ({
    ...STORED,
    ...(patch as object),
  }));
  const deps = {
    preferences: { get, put },
    resolveCaller: vi.fn(async () => caller),
    logger: silentLogger(),
  } as unknown as ApiDeps;
  return { deps, get, put };
}

const get = (deps: ApiDeps): Promise<Response> =>
  createPreferencesHandler(deps).GET(new Request('http://yomi.test/api/preferences'));

const put = (deps: ApiDeps, body: unknown): Promise<Response> =>
  createPreferencesHandler(deps).PUT(
    new Request('http://yomi.test/api/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('the preferences route (INT-PREF-ROUTE, F-013-S1/S2)', () => {
  describe('GET', () => {
    it('answers the stored row with no-store', async () => {
      const { deps } = makeDeps();
      const response = await get(deps);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(STORED);
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('answers 401 without a session and never calls the service', async () => {
      const { deps, get: getFn } = makeDeps(null);
      const response = await get(deps);

      expect(response.status).toBe(401);
      expect(getFn).not.toHaveBeenCalled();
    });
  });

  describe('PUT', () => {
    it('stores a partial patch and answers the merged row', async () => {
      const { deps, put: putFn } = makeDeps();
      const response = await put(deps, { autoNextChapter: true });

      expect(response.status).toBe(200);
      expect(putFn).toHaveBeenCalledWith({ userId: CALLER.userId }, { autoNextChapter: true });
      expect(await response.json()).toMatchObject({ autoNextChapter: true });
    });

    it('answers 401 without a session and never calls the service', async () => {
      const { deps, put: putFn } = makeDeps(null);
      const response = await put(deps, { autoNextChapter: true });

      expect(response.status).toBe(401);
      expect(putFn).not.toHaveBeenCalled();
    });

    it('cannot be talked into another reader: the body has no user field', async () => {
      // THREAT T-04. The acting user is the session's; a body naming someone
      // else is ignored outright, because there is no parameter for it to land
      // in — the service takes the userId from the caller, never the body.
      const { deps, put: putFn } = makeDeps();
      const response = await put(deps, { autoNextChapter: false, userId: OTHER.userId });

      expect(response.status).toBe(200);
      expect(putFn).toHaveBeenCalledWith({ userId: CALLER.userId }, expect.anything());
    });

    it('refuses a body that is not an object', async () => {
      const { deps, put: putFn } = makeDeps();

      for (const body of ['just a string', 42, null, [1, 2]]) {
        const response = await createPreferencesHandler(deps).PUT(
          new Request('http://yomi.test/api/preferences', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
        expect(response.status, `body=${JSON.stringify(body)}`).toBe(422);
      }
      expect(putFn).not.toHaveBeenCalled();
    });

    it('propagates a service 422 with its code and field intact', async () => {
      // The route's job is transport: a validation failure must arrive with
      // its code and its field, not translated into something vaguer. No
      // casts: the stub satisfies the port, and a cast would hide the wiring
      // this test exists to check.
      const { createPreferenceService } =
        await import('../../src/features/reader-preferences/preference.service');
      const real = createPreferenceService({
        preferences: {
          get: async () => ({ ...STORED }),
          put: async () => ({ ...STORED }),
        },
      });
      const response = await createPreferencesHandler({
        preferences: real,
        resolveCaller: async () => CALLER,
        logger: silentLogger(),
      } as unknown as ApiDeps).PUT(
        new Request('http://yomi.test/api/preferences', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ zoomDefault: 99 }),
        }),
      );

      expect(response.status).toBe(422);
      const body = (await response.json()) as { error?: { code?: string } };
      expect(body.error?.code).toBe('VALIDATION_BAD_QUERY');
    });
  });
});
