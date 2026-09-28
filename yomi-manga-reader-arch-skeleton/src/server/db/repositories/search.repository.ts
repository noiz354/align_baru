/**
 * The search repository: one composed query, four bands, a keyset cursor.
 *
 * What this query does
 * --------------------
 * A single statement returns every hit — manga rows for title/alias/creator/tag
 * matches, creator rows for creator-name matches, and tag rows for tag-name
 * matches — each carrying its band. A manga that matches in two bands is returned
 * once, with its BEST band, so ranking is a property of the row, not of the page.
 *
 * Bands, best to worst (FR-SEARCH-004): exact (the whole title, case-insensitive)
 * → prefix (`ILIKE 'q%'`) → contains (`%` similarity OR `ILIKE '%q%'`) → related
 * (a creator or tag name matched, resolved into the title that carries them, plus
 * the creator/tag row itself). Inside a band the order is title A–Z (folded to
 * lower case, so case never decides), then id. The integer `score` is the band's
 * weight — 400/300/200/100 — higher is better, and it exists so the service and
 * the client never have to re-derive the order.
 *
 * Why two rows for a creator/tag match
 * ------------------------------------
 * The port's `kind` is `'manga' | 'creator' | 'tag'`, which only makes sense if a
 * creator query can return a CREATOR. A creator match therefore emits the creator
 * row AND the manga row for each visible title they touch (same for tags), both
 * in the related band. A schema that could never produce two of its three kinds
 * would be another dead branch, and the recent slices have been nothing but the
 * removal of those.
 *
 * Why contains is `%` OR substring
 * ---------------------------------
 * A pure `%` would miss a title that merely contains `q` below the similarity
 * threshold, and "contains" that cannot find a substring is the band's name
 * lying. `ILIKE '%q%'` is the other half, and both halves ride the same GIN
 * trigram index (`gin_trgm_ops` accelerates `LIKE`/`ILIKE` as well as `%`), which
 * the EXPLAIN gate proves rather than assumes — see the index note and the test.
 *
 * What this query does NOT do
 * ---------------------------
 * - It never returns an unpublished, soft-deleted or draft title, even to an
 *   admin (EC-SE-03). Search is anonymous and public; the visibility filter is IN
 *   the query, per branch, because a filter applied afterwards would let a row
 *   count change underneath the cursor.
 * - It never builds SQL from `q`. The only shapes are bound-parameter
 *   comparisons; `%`, `_` and `\` inside `q` are escaped with `ESCAPE '\'`, so a
 *   query of `%` matches a literal percent sign and not everything (NFR-SEC-015).
 * - It never answers an empty `q` with the whole catalogue. `LIKE '%%'` matches
 *   every title, so an empty normalised query returns no rows at this level —
 *   the service is where `{}` becomes a 422. Defence in depth, not duplication:
 *   the port cannot be called into answering "everything".
 *
 * The CJK short-query path (F-010-S2)
 * -----------------------------------
 * A 1–2 code-point CJK query takes the prefix path ONLY. Trigram similarity at
 * that length is noise, and the `%q%` scan is the most expensive branch of the
 * union, so running it is paying for wrong answers. The gate is on the query,
 * not the branch: a boolean parameter holds the decision, so the statement has
 * one shape for every `q` and the planner sees a stable query.
 *
 * The cursor
 * ----------
 * `{v:1, s:'search', r:rank, k:lower(sort_title), i:id}` as base64url, following
 * `manga.repository.ts`'s format — same versioning, same reject-rather-than-repair
 * on anything unrecognised, same "a cursor is not portable across sorts". The
 * predicate is a row comparison on exactly the ORDER BY keys
 * (`(rank, lower(sort_title), id)`), which is what makes page 2 start where page 1
 * ended instead of where page 1 started. `LIMIT n+1` decides whether a cursor is
 * minted at all.
 *
 * Requirements: FR-SEARCH-001…004, NFR-PERF-005/014, NFR-SEC-015, DATA_MODEL §19.
 * Tasks: T-SEARCH-001, T-SEARCH-002 (indexes/EXPLAIN), T-PERF-004.
 */
import { sql } from 'drizzle-orm';
import { AppError } from '../../../shared/contracts/errors';
import type { Db } from '../client';
import type { SearchRepository } from '../../../features/search/search.repository';

/** Band ranks, best first. The score IS the rank weight, higher is better. */
const RANKS = { exact: 1, prefix: 2, contains: 3, related: 4 } as const;
const SCORES = { exact: 400, prefix: 300, contains: 200, related: 100 } as const;

/** What a `q` that must not touch contains looks like: 1–2 CJK code points. */
const CJK_RE =
  // CJK Unified Ideographs (incl. extensions A–F), Hiragana, Katakana, Hangul
  // (syllables, Jamo, compat), CJK symbols/punctuation, fullwidth forms.
  /^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u{20000}-\u{2EBEF}\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u3000-\u303F\uFF00-\uFFEF]{1,2}$/u;

/** Escape the three LIKE metacharacters so `q` is always data (NFR-SEC-015). */
function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Whether `q`, trimmed, is a short CJK query that takes the prefix path only. */
export function isShortCjkQuery(q: string): boolean {
  return CJK_RE.test(q.trim());
}

/** The cursor payload. `k` is `lower(sort_title)` — exactly the ORDER BY key. */
interface SearchCursor {
  v: 1;
  s: 'search';
  r: number;
  k: string;
  i: string;
}

function encodeCursor(rank: number, lowerTitle: string, id: string): string {
  const payload: SearchCursor = { v: 1, s: 'search', r: rank, k: lowerTitle, i: id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decode a cursor, or throw `CATALOG_PAGE_INVALID` (422) — the same code the
 * catalog repositories use for a hostile cursor, because the failure is the
 * same shape: data that cannot be trusted as a position.
 */
function decodeCursor(cursor: string): SearchCursor {
  const invalid = (): never => {
    throw new AppError('CATALOG_PAGE_INVALID');
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return invalid();
  }
  if (typeof parsed !== 'object' || parsed === null) return invalid();
  const candidate = parsed as Partial<SearchCursor>;
  if (candidate.v !== 1 || candidate.s !== 'search') return invalid();
  if (typeof candidate.r !== 'number' || !Number.isInteger(candidate.r)) return invalid();
  if (typeof candidate.k !== 'string' || typeof candidate.i !== 'string') return invalid();
  if (candidate.k === '' || candidate.i === '') return invalid();
  return { v: 1, s: 'search', r: candidate.r, k: candidate.k, i: candidate.i };
}

type RawHit = {
  kind: string;
  id: string;
  slug: string | null;
  title: string;
  match_field: string;
  rank: number;
  score: number;
  sort_title: string;
};

/**
 * One composed query per search (NFR-PERF-014: no N+1 fan-out).
 *
 * The visibility filter is per BRANCH rather than once at the end: a filter in
 * the outer query would change which rows survive after the cursor was minted
 * against positions that had already counted the excluded ones.
 */
function searchQuery(
  q: string,
  allowContains: boolean,
  limitPlusOne: number,
  cursor: SearchCursor | null,
): ReturnType<typeof sql<RawHit>> {
  const escaped = escapeLike(q);

  const visibility = sql`m.published AND m.deleted_at IS NULL`;

  const containsGate = allowContains
    ? sql``
    : sql`AND FALSE /* 1–2 CJK code points: prefix path only, trigram contains is noise at this length */`;

  // The cursor is a position on the ORDER BY keys. A row comparison is the only
  // predicate that restarts exactly where the last page stopped.
  const cursorGate =
    cursor === null
      ? sql``
      : sql`AND (b.rank, lower(b.sort_title), b.id) > (${cursor.r}, ${cursor.k}, ${cursor.i})`;

  return sql<RawHit>`
    WITH ranked AS (
      -- exact: the whole title, case-insensitive
      SELECT m.id, m.slug, m.title, 'manga' AS kind,
             'title' AS match_field, m.title AS sort_title,
             ${RANKS.exact}::integer AS rank, ${SCORES.exact}::integer AS score
        FROM manga m
       WHERE ${visibility} AND lower(m.title) = lower(${q})
      UNION ALL
      -- prefix: title
      SELECT m.id, m.slug, m.title, 'manga',
             'title', m.title,
             ${RANKS.prefix}::integer, ${SCORES.prefix}::integer
        FROM manga m
       WHERE ${visibility} AND lower(m.title) LIKE lower(${escaped}) || '%' ESCAPE '\\'
      UNION ALL
      -- prefix: alias
      SELECT m.id, m.slug, m.title, 'manga',
             'alias', m.title,
             ${RANKS.prefix}::integer, ${SCORES.prefix}::integer
        FROM manga m
        JOIN manga_alias a ON a.manga_id = m.id
       WHERE ${visibility} AND lower(a.alias) LIKE lower(${escaped}) || '%' ESCAPE '\\'
      UNION ALL
      -- contains: title (trigram similarity OR substring — see the file header
      -- for why one without the other is the band's name lying)
      SELECT m.id, m.slug, m.title, 'manga',
             'title', m.title,
             ${RANKS.contains}::integer, ${SCORES.contains}::integer
        FROM manga m
       WHERE ${visibility}
         ${containsGate}
         AND (m.title % ${q}
              OR lower(m.title) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\')
      UNION ALL
      -- contains: alias
      SELECT m.id, m.slug, m.title, 'manga',
             'alias', m.title,
             ${RANKS.contains}::integer, ${SCORES.contains}::integer
        FROM manga m
        JOIN manga_alias a ON a.manga_id = m.id
       WHERE ${visibility}
         ${containsGate}
         AND (a.alias % ${q}
              OR lower(a.alias) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\')
      UNION ALL
      -- related: the creator row itself
      SELECT c.id, NULL AS slug, c.name, 'creator',
             'creator', c.name,
             ${RANKS.related}::integer, ${SCORES.related}::integer
        FROM creator c
       WHERE lower(c.name) LIKE lower(${escaped}) || '%' ESCAPE '\\'
          OR lower(c.name) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\'
          OR c.name % ${q}
      UNION ALL
      -- related: titles that carry a matching creator
      SELECT m.id, m.slug, m.title, 'manga',
             'creator', m.title,
             ${RANKS.related}::integer, ${SCORES.related}::integer
        FROM manga m
        JOIN manga_creator mc ON mc.manga_id = m.id
        JOIN creator c ON c.id = mc.creator_id
       WHERE ${visibility}
         AND (lower(c.name) LIKE lower(${escaped}) || '%' ESCAPE '\\'
              OR lower(c.name) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\'
              OR c.name % ${q})
      UNION ALL
      -- related: the tag row itself
      SELECT t.id, NULL AS slug, t.name, 'tag',
             'tag', t.name,
             ${RANKS.related}::integer, ${SCORES.related}::integer
        FROM tag t
       WHERE lower(t.name) LIKE lower(${escaped}) || '%' ESCAPE '\\'
          OR lower(t.name) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\'
          OR t.name % ${q}
      UNION ALL
      -- related: titles that carry a matching tag
      SELECT m.id, m.slug, m.title, 'manga',
             'tag', m.title,
             ${RANKS.related}::integer, ${SCORES.related}::integer
        FROM manga m
        JOIN manga_tag mt ON mt.manga_id = m.id
        JOIN tag t ON t.id = mt.tag_id
       WHERE ${visibility}
         AND (lower(t.name) LIKE lower(${escaped}) || '%' ESCAPE '\\'
              OR lower(t.name) LIKE '%' || lower(${escaped}) || '%' ESCAPE '\\'
              OR t.name % ${q})
    ),
    -- A title matched in two bands answers once, with its best one. The ORDER
    -- BY inside DISTINCT ON is what "best" means, and it is the band rank —
    -- nothing else in this query is allowed to decide precedence.
    best AS (
      SELECT DISTINCT ON (kind, id)
             kind, id, slug, title, match_field, sort_title, rank, score
        FROM ranked
       ORDER BY kind, id, rank ASC
    )
    SELECT b.kind, b.id, b.slug, b.title,
           b.match_field, b.rank, b.score, b.sort_title
      FROM best b
     WHERE TRUE
       ${cursorGate}
     ORDER BY b.rank ASC, lower(b.sort_title) ASC, b.id ASC
     LIMIT ${limitPlusOne}
  `;
}

export function createSearchRepository(db: Db): SearchRepository {
  return {
    async searchRaw(input: { q: string; limit: number; cursor: string | null }) {
      const q = input.q.trim();
      // An empty q after trim would answer `LIKE '%%'` — the whole catalogue.
      // The service rejects it as a 422; this level answers "nothing" rather than
      // "everything", because the port cannot be called into listing all titles.
      if (q === '') return { rows: [], nextCursor: null };

      const limit = Math.min(Math.max(Math.floor(input.limit), 1), 48);
      const decoded: SearchCursor | null =
        input.cursor === null ? null : decodeCursor(input.cursor);
      const rows = await db.execute(searchQuery(q, !isShortCjkQuery(q), limit + 1, decoded));

      const hasMore = rows.length > limit;
      const kept = (hasMore ? rows.slice(0, limit) : rows) as RawHit[];
      const last = kept[kept.length - 1];
      const nextCursor =
        hasMore && last !== undefined
          ? encodeCursor(last.rank, last.sort_title.toLowerCase(), last.id)
          : null;

      return {
        rows: kept.map((row) => ({
          kind: row.kind as 'manga' | 'creator' | 'tag',
          id: row.id,
          slug: row.slug,
          title: row.title,
          matchField: row.match_field as 'title' | 'alias' | 'creator' | 'tag',
          band:
            row.rank === RANKS.exact
              ? 'exact'
              : row.rank === RANKS.prefix
                ? 'prefix'
                : row.rank === RANKS.contains
                  ? 'contains'
                  : 'related',
          score: row.score,
        })),
        nextCursor,
      };
    },
  };
}
