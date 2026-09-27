/**
 * features/catalog — CatalogService: query composition for the public
 * catalog (list, detail, chapter list, resume).
 *
 * Responsibility: combine manga/chapter/progress reads into the public
 * DTOs; cursor/filter/sort composition; the "continue reading" resolution
 * (FR-CATALOG-008, shared with the library home list).
 *
 * Requirements: FR-CATALOG-001…008, FR-CHAPTER-002, NFR-PERF-004.
 * Tasks: T-CATALOG-002 (list + facets), T-CATALOG-006 (detail),
 * T-CATALOG-007 (chapter list), T-CATALOG-009 (resume resolution).
 *
 * Rules:
 * - Catalog logic is PURE w.r.t. auth: it receives an optional
 *   `CallerContext` (data-flow.md §1) — the WEB layer applies guards;
 *   catalog never imports features/auth (DAG rule).
 * - `latestChapter`/`firstChapter` are computed in ONE query (no N+1,
 *   NFR-PERF-004/014).
 * - Hidden manga (unpublished/deleted) resolve as 404-shaped nulls
 *   (no existence leak — API_CONTRACT §1).
 */
import { AppError } from '../../shared/contracts/errors';
import type {
  ChapterSummary,
  MangaDetail,
  MangaStatus,
  MangaSummary,
} from '../../shared/contracts';
import type { MangaSlug } from '../../shared/types';
import { assertCatalogCursorToken } from './catalog-cursor';
import {
  CATALOG_DEFAULT_LIMIT,
  CATALOG_MAX_GENRES,
  CATALOG_MAX_LIMIT,
  CATALOG_SORTS,
  CATALOG_STATUSES,
  normaliseGenreSlug,
} from './catalog.repository';
import type { CatalogFacets, CatalogVocabularyPort } from './catalog-vocabulary';
import type { ResumePosition } from '../progress/resume.service';
import type { CallerContext, CatalogQuery } from './catalog.repository';

/**
 * The chapter-list hard cap (API_CONTRACT §2.1: "≤ 500 chapters per manga
 * realistic; hard cap 1000 → 409 `CHAPTER_LIST_TOO_LARGE`, ops alert"; §6's row
 * for that code names the trigger "> 1000 chapters (data problem)").
 *
 * Requirements: FR-CATALOG-007. Task: T-CATALOG-007.
 */
export const CHAPTER_LIST_HARD_CAP = 1000;

/** What the web layer may ask for beyond the caller's own visibility. */
export interface ChapterListOptions {
  /**
   * API_CONTRACT §2.1: "admin caller receives drafts too (flag `includeDrafts`
   * honored only for admin role)".
   *
   * Resolved as: drafts appear ONLY when the flag is set AND the caller is an
   * admin. Absent or false ⇒ published-only for every caller, admin included.
   * (The sentence also reads as "admins always get drafts"; that reading would
   * leave the flag with no effect for the only role it can affect, so the flag
   * is the switch. Recorded as a spec-question in the task report.)
   */
  readonly includeDrafts?: boolean;
}

export interface CatalogService {
  /**
   * The catalog list.
   *
   * `query` is the RAW form ({@link RawCatalogQuery}), not the port's
   * {@link CatalogQuery}: this method IS the validating boundary for a catalog
   * query, and a signature that only accepted already-typed values could not
   * reject anything. `normaliseCatalogQuery` turns the raw form into a
   * `CatalogQuery` — that is the only conversion, and it happens before the
   * repository is called.
   */
  list(query: RawCatalogQuery): Promise<{ items: MangaSummary[]; nextCursor: string | null }>;

  detail(slug: MangaSlug, caller: CallerContext): Promise<MangaDetail | null>;

  chapterList(
    slug: MangaSlug,
    caller: CallerContext,
    options?: ChapterListOptions,
  ): Promise<ChapterSummary[] | null>;

  /**
   * The public genre/tag vocabulary behind `GET /api/v1/catalog/facets`, which
   * T-CATALOG-004's filter controls consume. No counts (out of scope).
   *
   * Requirements: FR-CATALOG-002. Task: T-CATALOG-002.
   */
  facets(query?: { onlyUsed?: boolean }): Promise<CatalogFacets>;

  /**
   * Resume resolution (FR-CATALOG-008): given caller + manga →
   * last-read chapter + page/scroll, or null.
   * Rules (T-CATALOG-009):
   * - deepest STARTED position (not completed-only)
   * - completed manga → next UNREAD chapter (if any) else null
   * - progress on a deleted chapter → skip to previous valid
   * - anonymous caller → null (no error)
   * TODO(T-CATALOG-009).
   */
  resolveResume(
    mangaId: string,
    caller: CallerContext,
  ): Promise<{
    chapterId: string;
    chapterNumber: number;
    pageNumber: number;
    scrollOffset: number;
  } | null>;
}

/** The ports this service is built from (dependency-rules.md §2, D1). */
export interface CatalogServiceDeps {
  manga: import('../manga').MangaRepository;
  chapters: import('../chapters').ChapterRepository;
  /**
   * Resume reads. Typed as the published `ProgressReader` port so every existing
   * double stays valid, and widened to the `ResumeService` extension at the call
   * site (see {@link CatalogService.resolveResume}). Optional: a boot that has
   * not registered it must still serve the catalog list, and required-ness would
   * force a fake at the composition root (AGENTS.md §4.3).
   */
  progress?: import('../progress').ProgressReader;
  /**
   * Genre/tag vocabulary for the facets endpoint. Optional so a boot that has
   * not registered it yet still serves the catalog list; `facets()` then
   * reports the wiring gap instead of inventing rows.
   */
  vocabulary?: CatalogVocabularyPort;
}

/**
 * The resume RULES, as the catalog service consumes them.
 *
 * `CatalogServiceDeps.progress` is typed as the published `ProgressReader` port
 * on purpose, so every existing double stays valid. `ResumeService` EXTENDS
 * that port with the rule evaluation T-CATALOG-009 owns, and the composition
 * root injects an instance of it — so this intersection is the honest shape of
 * what actually arrives, and a plain `ProgressReader` without the rules says so
 * instead of answering from the port.
 */
type ProgressReader = NonNullable<CatalogServiceDeps['progress']>;
type ResumeRules = {
  resolveResume(
    mangaId: import('../../shared/types').MangaId,
    caller: CallerContext,
  ): Promise<ResumePosition | null>;
};

/**
 * The resume RULES on a `ProgressReader`, or `null` when it has none.
 *
 * The type intersection above is a compile-time claim; this is its RUNTIME
 * counterpart, and it is not optional bookkeeping. `CatalogServiceDeps.progress`
 * is the published `ProgressReader` port, and a plain port double — the shape
 * the integration harness injects, and the shape any caller that only wants
 * `latestForManga` would inject — has no `resolveResume` at all. Calling it
 * unguarded turns every detail read for such a caller into a 500, which is how
 * a type-level widening became a real outage in the first draft of this method.
 */
function resumeRulesOf(progress: ProgressReader | undefined): ResumeRules | null {
  if (progress === undefined) return null;
  return 'resolveResume' in progress && typeof progress.resolveResume === 'function'
    ? (progress as ProgressReader & ResumeRules)
    : null;
}

/* ── input shape: what a validated query looks like once untyped ─────────── */

/**
 * The catalog query as it arrives from an untrusted source (an RSC searchParams
 * bag, a route handler's URL). Every field is `unknown`-shaped: the whole
 * point of `normaliseCatalogQuery` is that NOTHING here is trusted.
 */
export interface RawCatalogQuery {
  cursor?: unknown;
  limit?: unknown;
  genres?: unknown;
  status?: unknown;
  sort?: unknown;
}

/**
 * The catalog query after normalisation: every field resolved and bounded.
 *
 * The compile-time proof that this is exactly the port's `CatalogQuery` is the
 * `manga.list(resolved)` call in {@link createCatalogService}: if the two ever
 * drift, that argument stops typechecking. (An explicit `satisfies` clause
 * would say the same thing, but TypeScript 6.0 — the version this repository
 * pins — rejects `satisfies` on a type alias, and a proof that needs a
 * workaround is not worth having.)
 */
export interface ResolvedCatalogQuery {
  /** The opaque token, or undefined for the first page. */
  cursor?: string;
  limit: number;
  /** Normalised slugs that could name a `genre` row; may be empty. */
  genres: string[];
  status?: MangaStatus;
  sort: NonNullable<CatalogQuery['sort']>;
}

/* ── normalisation (T-02) ────────────────────────────────────────────────── */

/**
 * THE ONE RULE for query parsing, and the reason the two contract sentences
 * about unknown values read the way they do:
 *
 *   A WHITELIST REJECTS. A LIST IGNORES.
 *
 * - `sort`/`status` are whitelists ("enum/whitelist for sort/status"), so any
 *   value that is not a member — INCLUDING the empty string `?sort=` — is a
 *   typed 422. The empty string is a value somebody sent and it names nothing.
 * - `cursor`/`limit` are not whitelists but §6 gives `CATALOG_PAGE_INVALID` the
 *   trigger "bad cursor/limit", so a present-but-unusable value is a typed 422
 *   rather than a silent fallback to page 1 (which would hide a broken
 *   pagination link).
 * - `genre` is a csv LIST and the contract says "genre slugs must exist
 *   (ignored if not — no error)", so empty and unmatchable tokens are dropped.
 *
 * "Absent" means the key is not in the bag at all (`undefined`/`null`); it is
 * deliberately NOT the same as "present and empty". Treating them alike is how
 * a typo'd `?limit=` silently becomes "24 per page" in production.
 */
function isPresent(raw: unknown): boolean {
  return raw !== undefined && raw !== null;
}

function invalidQuery(details: Array<{ path: string; message: string }>): AppError {
  return new AppError('VALIDATION_BAD_QUERY', { details });
}

function invalidPagination(): AppError {
  return new AppError('CATALOG_PAGE_INVALID');
}

/**
 * `limit`: absent ⇒ the FR-CATALOG-001 default; above the API_CONTRACT §2.1
 * ceiling ⇒ clamped (a page size is not a client mistake worth a 422, and §2.1
 * words it as a bound rather than a validation rule); anything else — zero,
 * negative, non-numeric, or present-but-empty ⇒ `CATALOG_PAGE_INVALID`.
 */
function normaliseLimit(raw: unknown): number {
  if (!isPresent(raw)) return CATALOG_DEFAULT_LIMIT;
  const limit = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(limit) || limit <= 0) throw invalidPagination();
  const whole = Math.floor(limit);
  return whole > CATALOG_MAX_LIMIT ? CATALOG_MAX_LIMIT : whole;
}

/**
 * `genre`: a csv of slugs. A sixth slug is a 422 because the contract states
 * "≤ 5" as a property of the input; a token that cannot name a genre row is
 * dropped silently (task edge case: "unknown genre slug ignored (not error)").
 */
function normaliseGenres(raw: unknown): string[] {
  if (!isPresent(raw)) return [];
  const tokens = (Array.isArray(raw) ? raw : String(raw).split(','))
    .filter((token): token is string => typeof token === 'string')
    .map(normaliseGenreSlug)
    .filter((slug): slug is string => slug !== null);
  if (tokens.length > CATALOG_MAX_GENRES) {
    throw invalidQuery([
      {
        path: 'genre',
        message: `At most ${String(CATALOG_MAX_GENRES)} genres may be filtered at once.`,
      },
    ]);
  }
  return [...new Set(tokens)];
}

/** `sort` / `status`: whitelist membership or a typed 422 (T-02). */
function normaliseSort(raw: unknown): NonNullable<CatalogQuery['sort']> {
  if (!isPresent(raw)) return 'updated_desc';
  if (!CATALOG_SORTS.includes(raw as NonNullable<CatalogQuery['sort']>)) {
    throw invalidQuery([
      { path: 'sort', message: `Sort must be one of: ${CATALOG_SORTS.join(', ')}.` },
    ]);
  }
  return raw as NonNullable<CatalogQuery['sort']>;
}

function normaliseStatus(raw: unknown): MangaStatus | undefined {
  if (!isPresent(raw)) return undefined;
  if (!CATALOG_STATUSES.includes(raw as MangaStatus)) {
    throw invalidQuery([
      { path: 'status', message: `Status must be one of: ${CATALOG_STATUSES.join(', ')}.` },
    ]);
  }
  return raw as MangaStatus;
}

/**
 * Composes an untrusted query into the bounded form the repository receives.
 *
 * Total over the input space of interest: it either returns a query whose every
 * field is whitelisted, defaulted or dropped, or throws a typed `AppError`.
 * There is no third outcome, so a caller cannot forward a value it has not
 * decided about.
 *
 * Requirements: FR-CATALOG-001…004, NFR-SEC-015. Task: T-CATALOG-002.
 * @throws {AppError} `VALIDATION_BAD_QUERY` (422) for a non-whitelisted
 *   sort/status or a sixth genre; `CATALOG_PAGE_INVALID` (422) for a bad cursor
 *   or limit.
 */
export function normaliseCatalogQuery(raw: RawCatalogQuery): ResolvedCatalogQuery {
  const cursor = raw.cursor;
  const hasCursor = isPresent(cursor);
  // Bounded here so a token that is not a cursor at all is a 422 at the edge
  // and never reaches a query (API_CONTRACT §1: "Zod at the edge"). The token
  // is then forwarded BYTE-FOR-BYTE: its payload is the repository's to read
  // (T-CATALOG-001), and re-encoding it here is how the two formats diverged.
  if (hasCursor) assertCatalogCursorToken(String(cursor));
  const resolved: ResolvedCatalogQuery = {
    limit: normaliseLimit(raw.limit),
    genres: normaliseGenres(raw.genres),
    sort: normaliseSort(raw.sort),
  };
  const status = normaliseStatus(raw.status);
  if (status !== undefined) resolved.status = status;
  if (hasCursor) resolved.cursor = String(cursor);
  return resolved;
}

/* ── DTO normalisation at the port boundary (data-flow.md §7) ────────────── */

/**
 * `numeric(8,2)` reaches a repository as a STRING by design (ADR-003 R2,
 * `server/db/columns.ts`), while the DTOs say `number`. The conversion happens
 * here, once, so no consumer re-parses it and no float drift is introduced
 * (`'10.50'` → 10.5, never 10.499999…).
 *
 * @throws {AppError} `INTERNAL_ERROR` when the stored value is not a number —
 *   a broken repository invariant, not a client error, and never a data value.
 */
function chapterNumber(raw: unknown): number {
  const parsed = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AppError('INTERNAL_ERROR', { cause: new Error('chapter number is not numeric') });
  }
  return parsed;
}

function normaliseChapter(row: ChapterSummary): ChapterSummary {
  return { ...row, number: chapterNumber(row.number) };
}

/* ── the wiring ──────────────────────────────────────────────────────────── */

/**
 * Builds the service over its ports (T-CATALOG-002).
 *
 * @param deps the ports, injected at the composition root (D1/D6)
 * @returns the service
 */
export function createCatalogService(deps: CatalogServiceDeps): CatalogService {
  const { manga, chapters, progress, vocabulary } = deps;

  return {
    /**
     * FR-CATALOG-001…005. ONE `MangaRepository.list` call per request, so
     * `latestChapter` arrives with its row: the single-query rule
     * (NFR-PERF-004) is a property of this method having no other read in it,
     * and UNIT-CAT-002 asserts exactly that against a counting double.
     */
    async list(
      query: RawCatalogQuery,
    ): Promise<{ items: MangaSummary[]; nextCursor: string | null }> {
      const resolved = normaliseCatalogQuery(query);
      const page = await manga.list({ ...resolved });
      return {
        items: page.items.map((item) => ({
          ...item,
          latestChapter:
            item.latestChapter === null || item.latestChapter === undefined
              ? null
              : { ...item.latestChapter, number: chapterNumber(item.latestChapter.number) },
        })),
        nextCursor: page.nextCursor,
      };
    },

    /**
     * FR-CATALOG-006. ONE `MangaRepository.bySlug` call, which is also the
     * visibility gate: a slug that is unknown, unpublished or soft-deleted
     * resolves to `null` (API_CONTRACT §1 no-existence-leak), and the route
     * turns that into `MANGA_NOT_FOUND` 404. `null` is therefore a real answer,
     * not an error.
     *
     * The aliases/genres/tags/creators/first/latest rows all arrive with that
     * one read (T-CATALOG-001), so this method has no second query and no
     * fan-out (NFR-PERF-004/014).
     *
     * `continueReading` (FR-CATALOG-008) is added ONLY for a real caller with
     * a position, and it is OMITTED — never null — otherwise, so an anonymous
     * reader and a signed-in reader who has not started look identical on the
     * wire. The resume RULES live in `features/progress`; this is the
     * delegation, so the detail page and the reader cannot disagree about where
     * "continue" points.
     *
     * Requirements: FR-CATALOG-006/008, NFR-PERF-004.
     * Tasks: T-CATALOG-006, T-CATALOG-009.
     */
    async detail(slug: MangaSlug, caller: CallerContext): Promise<MangaDetail | null> {
      const found = await manga.bySlug(slug, caller);
      if (found === null) return null;
      // `numeric(8,2)` reaches the repository as a STRING (ADR-003 R2), so both
      // chapter numbers are converted here, once, like `normaliseChapter` does
      // for a chapter row. The two shapes are deliberately normalised
      // separately: `firstChapter` is `{id, number}` and `latestChapter` is
      // `{number, title, publishedAt}` (MangaDetail vs MangaSummary), so
      // sharing one helper would launder a field that is not on both.
      const base = {
        ...found,
        ...(found.latestChapter === null
          ? {}
          : { latestChapter: { ...found.latestChapter, number: chapterNumber(found.latestChapter.number) } }),
        ...(found.firstChapter === null
          ? {}
          : { firstChapter: { ...found.firstChapter, number: chapterNumber(found.firstChapter.number) } }),
      };

      // FR-CATALOG-008. Anonymous → absent, no error: the position is on the
      // device until sign-in (T-READER-024), so the server has nothing to say.
      // And a port WITHOUT the rules → absent, not a 500: the detail page must
      // still render, and it has no business failing over an optional field.
      if (caller === null) return base;
      const rules = resumeRulesOf(progress);
      if (rules === null) return base;
      const position = await rules.resolveResume(found.id, caller);
      // No progress yet → still absent, NOT null: "you have not started" and
      // "you are anonymous" are the same wire answer, and the page renders one
      // state for both.
      if (position === null) return base;
      return {
        ...base,
        continueReading: {
          chapterId: position.chapterId,
          chapterNumber: position.chapterNumber,
          pageNumber: position.pageNumber,
        },
      };
    },

    /**
     * FR-CATALOG-007, FR-CHAPTER-002/004. Two reads, both indexed, no fan-out:
     * `bySlug` resolves the slug AND applies the manga visibility rule (so a
     * draft or soft-deleted title is a 404, never an empty 200), then
     * `listByManga` returns the ordered rows.
     *
     * `MangaRepository.bySlug` is the only port method that resolves a slug to
     * a manga id under the visibility rule — the alternative would be a second
     * resolver this module does not own. It costs one extra indexed read, not
     * one per chapter.
     */
    async chapterList(
      slug: MangaSlug,
      caller: CallerContext,
      options: ChapterListOptions = {},
    ): Promise<ChapterSummary[] | null> {
      const detail = await manga.bySlug(slug, caller);
      if (detail === null) return null;
      const rows = await chapters.listByManga(detail.id, caller);
      const honourDrafts = caller?.role === 'admin' && options.includeDrafts === true;
      // Defence in depth: the port already scopes drafts by caller, and this
      // second filter is what makes "a non-admin never sees a draft" a property
      // of THIS module and not only of the repository behind it.
      const visible = honourDrafts ? rows : rows.filter((row) => row.publishedAt !== null);
      if (visible.length > CHAPTER_LIST_HARD_CAP) {
        throw new AppError('CHAPTER_LIST_TOO_LARGE');
      }
      return visible.map(normaliseChapter);
    },

    /**
     * The public vocabulary for the filter controls (FR-CATALOG-002). Counts
     * are deliberately absent — out of scope for T-CATALOG-002, and a cheaper
     * read for it.
     */
    async facets(query: { onlyUsed?: boolean } = {}): Promise<CatalogFacets> {
      if (vocabulary === undefined) {
        throw new AppError('INTERNAL_ERROR', {
          cause: new Error('catalog vocabulary port is not registered'),
        });
      }
      const facets = await vocabulary.listVocabulary({ onlyUsed: query.onlyUsed ?? true });
      return { genres: facets.genres, tags: facets.tags };
    },

    /**
     * FR-CATALOG-008 / T-CATALOG-009. The rules (deepest STARTED position,
     * completed → next UNREAD, deleted chapter → previous valid, anonymous →
     * null) live in `features/progress/resume.service.ts`; this is the
     * delegation, so the catalog cannot drift from the reader's rules.
     *
     * Requirements: FR-CATALOG-008, FR-READER-022. Task: T-CATALOG-009.
     */
    async resolveResume(mangaId, caller) {
      // The rules live in `features/progress`'s `ResumeService`, which EXTENDS
      // the `ProgressReader` port this dependency is typed as. The guard is the
      // whole widening: a plain `ProgressReader` double is honest about not
      // having the rules, and says so instead of answering from the port.
      const rules = resumeRulesOf(progress);
      if (rules === null) {
        throw new AppError('INTERNAL_ERROR', {
          cause: new Error('catalog progress reader is not registered'),
        });
      }
      // The port types `mangaId` as `string`; the brand is the progress
      // feature's, and the cast is the same one its own adapter makes.
      return rules.resolveResume(mangaId as import('../../shared/types').MangaId, caller);
    },
  };
}
