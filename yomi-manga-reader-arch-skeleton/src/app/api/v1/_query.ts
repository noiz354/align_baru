/**
 * `/api/v1` query schemas — the Zod edge (API_CONTRACT §1: "Zod at the edge";
 * data-flow.md §5: "Web → feature: validated, typed inputs (Zod output)").
 *
 * ── What Zod decides here, and what it deliberately does not ─────────────
 * Zod decides SHAPE: that a value is a single string at all, and that the bag
 * carries nothing else. It does NOT re-implement the whitelists, the limit
 * bound, the csv cap or the cursor format — those live once, in
 * `normaliseCatalogQuery` (features/catalog), because they decide which TYPED
 * ERROR each failure gets, and two sources of truth for one rule is how they
 * drift. §1's division of labour is respected by having exactly one of them
 * own the value rules.
 *
 * That is also why a hostile `?sort=…` produces a 422 from the SERVICE and not
 * from Zod: the service answers `VALIDATION_BAD_QUERY` for a non-whitelisted
 * sort and `CATALOG_PAGE_INVALID` for a bad limit (§6 gives that code the
 * trigger "bad cursor/limit"), and a Zod-level `.min(1)` could only ever
 * produce the wrong one of the two.
 *
 * Requirements: API_CONTRACT §1, §2.1. Tasks: T-CATALOG-002, T-CATALOG-007.
 * Errors: VALIDATION_BAD_QUERY (T-FOUND-009 / API_CONTRACT §6).
 */
import { z } from 'zod';
import { AppError } from '../../../shared/contracts/errors';
import type { ErrorDetail } from '../../../shared/contracts/errors';
import { CATALOG_CURSOR_MAX_LENGTH } from '../../../features/catalog';

/**
 * Reads a `URLSearchParams` bag into a plain record of strings.
 *
 * `URLSearchParams.get` returns the FIRST value for a repeated key, so
 * `?limit=1&limit=2` is `limit=1` rather than an error. That is the same
 * reading every HTTP framework takes of a repeated scalar query parameter, and
 * rejecting it would be a rule no document states.
 *
 * @param url the request URL
 * @returns every key with a single string value
 */
function stringBag(url: URL): Record<string, string> {
  const bag: Record<string, string> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const value = url.searchParams.get(key);
    if (value !== null) bag[key] = value;
  }
  return bag;
}

/**
 * `GET /api/v1/catalog` — API_CONTRACT §2.1: `cursor?`, `limit?` (≤ 48),
 * `genre?` (csv slugs, ≤ 5), `status?`, `sort?`.
 *
 * Every field stays a string here. `.strip()` drops unknown keys so a client
 * cannot smuggle anything the service has not decided about, and the service
 * receives exactly the contract's own vocabulary.
 */
export const catalogQuerySchema = z
  .object({
    cursor: z.string().max(CATALOG_CURSOR_MAX_LENGTH).optional(),
    limit: z.string().optional(),
    genre: z.string().optional(),
    status: z.string().optional(),
    sort: z.string().optional(),
  })
  .strip()
  .transform((raw) => ({
    // `exactOptionalPropertyTypes` is on, so an absent key is OMITTED rather
    // than set to undefined — the service's "absent" test is `undefined`.
    ...(raw.cursor === undefined ? {} : { cursor: raw.cursor }),
    // The wire form is a string; `Number` keeps a non-numeric value as `NaN`,
    // which the service rejects as CATALOG_PAGE_INVALID rather than this
    // schema guessing at a second validation rule.
    ...(raw.limit === undefined ? {} : { limit: Number(raw.limit) }),
    // `genre` is a CSV on the wire (API_CONTRACT §2.1). Splitting it is a wire
    // concern; slugifying, de-duplicating and capping it is the service's.
    ...(raw.genre === undefined ? {} : { genres: raw.genre.split(',') }),
    ...(raw.status === undefined ? {} : { status: raw.status }),
    ...(raw.sort === undefined ? {} : { sort: raw.sort }),
  }));

/** `GET /api/v1/catalog/facets` — no parameters; the shape exists for symmetry. */
export const catalogFacetsQuerySchema = z.object({}).strip();

/** DATA_MODEL §21.5 / API_CONTRACT §2.1: a slug is at most 190 characters. */
export const MANGA_SLUG_MAX_LENGTH = 190;

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off']);

/**
 * `includeDrafts` (API_CONTRACT §2.1: "admin-only effect").
 *
 * A real boolean decision, so it IS decided at the edge: the spellings a client
 * may use are enumerated, and anything else is a 422 rather than a silent
 * `false`. An EMPTY value means "absent" (the flag is optional), which is the
 * one place the present-vs-empty rule of the catalog service does not apply —
 * there is no `?includeDrafts` in a link anyone writes by hand.
 */
const includeDraftsSchema = z
  .string()
  .optional()
  .superRefine((raw, ctx) => {
    if (raw === undefined) return;
    const value = raw.trim().toLowerCase();
    if (value === '' || TRUTHY.has(value) || FALSY.has(value)) return;
    ctx.addIssue({
      code: 'custom',
      message: 'Must be one of: true, false, 1, 0, yes, no, on, off.',
    });
  })
  .transform((raw) => {
    if (raw === undefined) return undefined;
    const value = raw.trim().toLowerCase();
    if (value === '') return undefined;
    return TRUTHY.has(value);
  });

/**
 * `GET /api/v1/manga/{slug}/chapters` — path `slug`, `includeDrafts?`.
 *
 * The slug is bounded in LENGTH only. No character-set rule is imposed: §2.1
 * says "slug format ≤ 190 chars" and DATA_MODEL §6/§3 make the slug unique
 * text, and a slug derived from a non-latin title is legitimate. Inventing an
 * ASCII-only rule here would 404 a title that exists. A slug that is in range
 * but matches nothing is a lookup miss, and the contract's answer to a miss is
 * 404 `MANGA_NOT_FOUND` (API_CONTRACT §1's no-existence-leak policy).
 */
export const chapterListQuerySchema = z
  .object({
    slug: z.string().min(1).max(MANGA_SLUG_MAX_LENGTH),
    includeDrafts: includeDraftsSchema,
  })
  .strip();

/**
 * `GET /api/v1/manga/{slug}` — path `slug` only.
 *
 * The same length bound and the same deliberate absence of a character-set
 * rule as the chapter list, for the same reason: §2.1 says "slug format ≤ 190
 * chars", and a slug derived from a non-latin title is legitimate. A slug in
 * range that matches nothing is a 404, not a 422 — the two answers mean
 * different things to the detail page (render the 404 page vs. render an
 * "unavailable" state), so conflating them would be a real defect.
 *
 * Requirements: FR-CATALOG-006. Task: T-CATALOG-011.
 */
export const mangaDetailQuerySchema = z
  .object({
    slug: z.string().min(1).max(MANGA_SLUG_MAX_LENGTH),
  })
  .strip();

/** The catalog query, as the service receives it. */
export type CatalogQueryInput = z.infer<typeof catalogQuerySchema>;

/** The chapter-list query, as the service receives it. */
export type ChapterListQueryInput = z.infer<typeof chapterListQuerySchema>;

/**
 * Parses a bag, or throws the typed 422.
 *
 * @param schema the Zod schema for the operation
 * @param input the raw string bag
 * @returns the parsed, typed input
 * @throws {AppError} `VALIDATION_BAD_QUERY` with one `details[]` entry per
 *   issue (API_CONTRACT §1: a validation failure carries `details[]` with a
 *   path + a user-visible message).
 */
export function parseQuery<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError('VALIDATION_BAD_QUERY', { details: zodIssues(result.error) });
}

/**
 * Projects a `ZodError` onto the §1 `details[]` shape.
 *
 * Only `path` and `message` are copied (T-FOUND-009's redaction rule: a
 * ZodError may carry the offending input on `issue.input`, and a client-supplied
 * value must never reach a body or a log line). Zod's own messages are
 * generated from the schema, not from the value, so they are user-safe copy.
 */
function zodIssues(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join('.');
    return { ...(path === '' ? {} : { path }), message: issue.message };
  });
}

export { stringBag };
