/**
 * Integration tests — continue-reading (resume) resolution against a REAL
 * PostgreSQL 18 (vitest + Drizzle, no mocks) — T-CATALOG-009.
 *
 * Planned ID: **INT-PROG-001 reuse** (the task's Testing row: "UNIT-PROG-003
 * sibling tests (resume logic), INT-PROG-001 reuse"). INT-PROG-001's original
 * subject — "2 sessions × 50 interleaved progress writes → final = the latest
 * server stamp" — belongs to T-READER-021/022 and is NOT covered here; this
 * file reuses the id for the resume slice of the same table, as the task asks.
 * The RULES are asserted at the unit level (`tests/unit/progress.resume.test.ts`,
 * UNIT-PROG-004). What only a real database can prove is here:
 *   - the one query that feeds the rules filters the right rows: a SOFT-deleted
 *     chapter KEEPS its `reading_progress` row (the FK cascades only on a hard
 *     delete), so without `deleted_at IS NULL` a reader would be resumed into a
 *     chapter that no longer exists;
 *   - `status = 'published'` keeps a draft chapter out of a resume entry
 *     (FR-CHAPTER-002) and `page_count >= 1` keeps an uncommitted chapter out;
 *   - `numeric(8,2)` chapter numbers survive the row → DTO mapping (10.5);
 *   - two readers never see each other's position, through the real SQL;
 *   - EC-RDR-10 clamping against a real (re-ingested, smaller) page count.
 *
 * DSN: `DATABASE_URL` (DEPLOYMENT.md §3). The suite SKIPS (never silently
 * passes) when it is absent, so `npm run test:unit` and a bare `npm test` work
 * without Docker. `beforeAll` drops and recreates the `public` schema, so the
 * DSN MUST point at a THROWAWAY database:
 *
 *   docker run -d --name yomi-resume-tmp -e POSTGRES_USER=yomi \
 *     -e POSTGRES_PASSWORD=yomi -e POSTGRES_DB=yomi -p 55445:5432 postgres:18.6-bookworm
 *   DATABASE_URL=postgres://yomi:yomi@127.0.0.1:55445/yomi \
 *     npx vitest run tests/integration/progress.resume.test.ts
 *
 * Note (`vitest.config.ts` runs integration files in ONE fork): do not point
 * this suite at the same database as `db-schema.test.ts` or
 * `seed.harness.test.ts`, which also drop the schema.
 * Every row below is a fixture written by this test (AGENTS.md §4.3); nothing
 * here is product data.
 */
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chapter, manga, readingProgress, users } from '../../src/server/db/schema';
import { closeDb, createDb, type Db } from '../../src/server/db/client';
import { runMigrations } from '../../src/server/db/migrations';
import { createProgressPositionReader } from '../../src/server/db/repositories/progress.repository';
import {
  createResumeService,
  type ResumePositionReader,
} from '../../src/features/progress/resume.service';
import type { CallerContext } from '../../src/shared/contracts';
import type { Env } from '../../src/shared/validation';
import type { ChapterId, MangaId, UserId } from '../../src/shared/types';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

type Sql = ReturnType<typeof postgres>;

/** The only Env field `createDb` reads is `databaseUrl` (DEPLOYMENT.md §3). */
function fakeEnv(databaseUrl: string): Env {
  return { databaseUrl } as Env;
}

/** Narrows an absent row value so a fixture bug fails loudly, not silently. */
function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected a row for ${what}`);
  return value;
}

/** A credential that is not a secret and never existed (AGENTS.md §4.6). */
const FIXTURE_PASSWORD_HASH = 'argon2id$fixture-not-a-real-hash$t-catalog-009';

/**
 * Drizzle's name for the composite PK `(user_id, chapter_id)` of DATA_MODEL
 * §12 — asserted against `pg_indexes` so a renamed key is a test failure, not a
 * comment that quietly stops being true.
 */
const READING_PROGRESS_PK = 'reading_progress_user_id_chapter_id_pk';

/** One node of an `EXPLAIN (FORMAT JSON)` plan. */
type PlanNode = {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
};

/** Flattens a plan tree so a node can be found by the relation it reads. */
function planNodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap((child) => planNodes(child))];
}

interface ChapterOpts {
  readingOrder: number;
  /** `numeric(8,2)` — passed as a string, the way the column reads back. */
  number: string;
  pageCount?: number;
  status?: 'draft' | 'published';
  deleted?: boolean;
}

interface ProgressOpts {
  page: number;
  scroll?: number;
  completed?: boolean;
  /** Server-stamped LWW basis (NFR-DATA-003); explicit so ordering is a fact. */
  updatedAt: string;
}

describeDb('INT-PROG-001 (reuse) — T-CATALOG-009 resume resolution on real PG', () => {
  let sql: Sql;
  let db: Db;
  /** Real Drizzle reader wrapped in a counter, so "no query was issued" is provable. */
  let reads: ResumePositionReader;
  let queries: Array<{ userId: UserId; mangaId: MangaId }> = [];

  const readerId: { value: UserId } = { value: '' as UserId };
  const otherId: { value: UserId } = { value: '' as UserId };
  const mangaIds = new Map<string, MangaId>();
  const chapterIds = new Map<string, ChapterId>();

  let CALLER: CallerContext;
  let OTHER_CALLER: CallerContext;

  /** Creates a published manga and remembers it by key. */
  async function makeManga(key: string): Promise<MangaId> {
    const [row] = await db
      .insert(manga)
      .values({ slug: `resume-${key}`, title: `Resume ${key}`, published: true })
      .returning({ id: manga.id });
    const id = must(row, `manga ${key}`).id as MangaId;
    mangaIds.set(key, id);
    return id;
  }

  /** Creates one chapter of `parent` and remembers it as `${key}`. */
  async function makeChapter(parent: MangaId, key: string, opts: ChapterOpts): Promise<ChapterId> {
    const status = opts.status ?? 'published';
    const [row] = await db
      .insert(chapter)
      .values({
        mangaId: parent,
        number: opts.number,
        readingOrder: opts.readingOrder,
        pageCount: opts.pageCount ?? 20,
        status,
        publishedAt: status === 'published' ? new Date('2026-01-01T00:00:00Z') : null,
        deletedAt: opts.deleted ? new Date('2026-02-01T00:00:00Z') : null,
      })
      .returning({ id: chapter.id });
    const id = must(row, `chapter ${key}`).id as ChapterId;
    chapterIds.set(key, id);
    return id;
  }

  /** Writes a `reading_progress` row — the same shape T-READER-021 will write. */
  async function setProgress(
    userId: UserId,
    chapterKey: string,
    opts: ProgressOpts,
  ): Promise<void> {
    await db.insert(readingProgress).values({
      userId,
      chapterId: must(chapterIds.get(chapterKey), `chapter ${chapterKey}`),
      pageNumber: opts.page,
      scrollPosition: opts.scroll ?? 0,
      completed: opts.completed ?? false,
      updatedAt: new Date(opts.updatedAt),
    });
  }

  function resumeService() {
    return createResumeService({ reads });
  }

  /**
   * `EXPLAIN` of exactly the query `createProgressPositionReader` issues (kept
   * hand-written so the plan can be read in the test output; the repository is
   * the thing under test elsewhere).
   */
  async function explainResumeQuery(): Promise<PlanNode> {
    const [row] = await sql<{ 'QUERY PLAN': [{ Plan: PlanNode }] }[]>`
      explain (format json)
      select c.id, c.number, c.reading_order, c.page_count,
             rp.page_number, rp.scroll_position, rp.completed
      from chapter c
      left join reading_progress rp
        on rp.chapter_id = c.id and rp.user_id = ${readerId.value}::uuid
      where c.manga_id = ${mangaId('a')}::uuid
        and c.deleted_at is null
        and c.status = 'published'
        and c.page_count >= 1
      order by c.reading_order asc
    `;
    return must(row?.['QUERY PLAN']?.[0]?.Plan, 'a query plan');
  }

  beforeAll(async () => {
    sql = postgres(DATABASE_URL as string, { max: 4 });
    await sql`drop schema if exists public cascade`;
    await sql`create schema public`;
    await runMigrations({ url: DATABASE_URL as string });
    db = await createDb(fakeEnv(DATABASE_URL as string));

    const real = createProgressPositionReader(db);
    reads = {
      async readResumeSnapshot(userId, mangaId) {
        queries.push({ userId, mangaId });
        return real.readResumeSnapshot(userId, mangaId);
      },
    };

    /* ── two readers ───────────────────────────────────────────────────── */
    const [first, second] = await db
      .insert(users)
      .values([
        { email: 'resume-reader@example.test', passwordHash: FIXTURE_PASSWORD_HASH },
        { email: 'resume-other@example.test', passwordHash: FIXTURE_PASSWORD_HASH },
      ])
      .returning({ id: users.id });
    readerId.value = must(first, 'reader').id as UserId;
    otherId.value = must(second, 'other reader').id as UserId;
    CALLER = { userId: readerId.value, role: 'reader' };
    OTHER_CALLER = { userId: otherId.value, role: 'reader' };

    /* ── A: two started chapters; the deeper one is NOT the newest row ── */
    const a = await makeManga('a');
    await makeChapter(a, 'a1', { readingOrder: 1, number: '1' });
    await makeChapter(a, 'a2', { readingOrder: 2, number: '2' });
    await makeChapter(a, 'a3', { readingOrder: 3, number: '3' });
    // a1 carries the NEWER server stamp on purpose: SQ-2 in the service header
    // records that "by progress.updated_at" would answer a1 here, and this row
    // makes that divergence executable evidence rather than a claim.
    await setProgress(readerId.value, 'a1', { page: 3, updatedAt: '2026-03-05T10:00:00Z' });
    await setProgress(readerId.value, 'a2', {
      page: 7,
      scroll: 0.25,
      updatedAt: '2026-03-01T10:00:00Z',
    });
    await setProgress(otherId.value, 'a2', { page: 15, updatedAt: '2026-03-09T10:00:00Z' });

    /* ── B: completed up to 2, chapter 3 unread → next unread ──────────── */
    const b = await makeManga('b');
    await makeChapter(b, 'b1', { readingOrder: 1, number: '1' });
    await makeChapter(b, 'b2', { readingOrder: 2, number: '2' });
    await makeChapter(b, 'b3', { readingOrder: 3, number: '3' });
    await setProgress(readerId.value, 'b1', { page: 20, completed: true, updatedAt: '2026-03-01' });
    await setProgress(readerId.value, 'b2', { page: 20, completed: true, updatedAt: '2026-03-02' });

    /* ── C: every chapter complete → null ──────────────────────────────── */
    const c = await makeManga('c');
    await makeChapter(c, 'c1', { readingOrder: 1, number: '1' });
    await makeChapter(c, 'c2', { readingOrder: 2, number: '2' });
    await setProgress(readerId.value, 'c1', { page: 20, completed: true, updatedAt: '2026-03-01' });
    await setProgress(readerId.value, 'c2', { page: 20, completed: true, updatedAt: '2026-03-02' });

    /* ── D: the DEEPEST started chapter was soft-deleted → previous wins ─ */
    const d = await makeManga('d');
    await makeChapter(d, 'd1', { readingOrder: 1, number: '1' });
    await makeChapter(d, 'd2', { readingOrder: 2, number: '2', deleted: true });
    await makeChapter(d, 'd3', { readingOrder: 3, number: '3' });
    await setProgress(readerId.value, 'd1', { page: 4, scroll: 0.5, updatedAt: '2026-03-01' });
    await setProgress(readerId.value, 'd2', { page: 9, updatedAt: '2026-03-05' });

    /* ── E: the ONLY started chapter was soft-deleted → nothing to resume ─ */
    const e = await makeManga('e');
    await makeChapter(e, 'e1', { readingOrder: 1, number: '1', deleted: true });
    await setProgress(readerId.value, 'e1', { page: 9, updatedAt: '2026-03-01' });

    /* ── F: draft + 0-page chapters are skipped; the next valid one wins ── */
    const f = await makeManga('f');
    await makeChapter(f, 'f1', { readingOrder: 1, number: '1' });
    await makeChapter(f, 'f2', { readingOrder: 2, number: '2', status: 'draft' });
    await makeChapter(f, 'f3', { readingOrder: 3, number: '3', pageCount: 0 });
    await makeChapter(f, 'f4', { readingOrder: 4, number: '4' });
    await setProgress(readerId.value, 'f1', { page: 20, completed: true, updatedAt: '2026-03-01' });
    // A draft chapter that still carries a stale progress row: it must not
    // become the resume target (FR-CHAPTER-002 — unpublished is 404-shaped).
    await setProgress(readerId.value, 'f2', { page: 5, updatedAt: '2026-03-06' });
    await setProgress(readerId.value, 'f3', { page: 1, updatedAt: '2026-03-07' });

    /* ── G: completed, then a deleted chapter, then completed → null ───── */
    const g = await makeManga('g');
    await makeChapter(g, 'g1', { readingOrder: 1, number: '1' });
    await makeChapter(g, 'g2', { readingOrder: 2, number: '2', deleted: true });
    await makeChapter(g, 'g3', { readingOrder: 3, number: '3' });
    await setProgress(readerId.value, 'g1', { page: 20, completed: true, updatedAt: '2026-03-01' });
    await setProgress(readerId.value, 'g2', { page: 20, completed: true, updatedAt: '2026-03-02' });
    await setProgress(readerId.value, 'g3', { page: 20, completed: true, updatedAt: '2026-03-03' });

    /* ── H: re-ingest shrank the chapter (20 → 8 pages) + a "10.5" number ─ */
    const h = await makeManga('h');
    await makeChapter(h, 'h1', { readingOrder: 1, number: '10.5', pageCount: 8 });
    await setProgress(readerId.value, 'h1', { page: 14, updatedAt: '2026-03-01' });

    /* ── I: published but never started → null ─────────────────────────── */
    const i = await makeManga('i');
    await makeChapter(i, 'i1', { readingOrder: 1, number: '1' });

    /* ── J: a manga with no published chapter at all → no snapshot ─────── */
    const j = await makeManga('j');
    await makeChapter(j, 'j1', { readingOrder: 1, number: '1', status: 'draft' });
  });

  afterAll(async () => {
    if (db) await closeDb(db);
    if (sql) await sql.end({ timeout: 5 });
  });

  const mangaId = (key: string): MangaId => must(mangaIds.get(key), `manga ${key}`);
  const chapterId = (key: string): ChapterId => must(chapterIds.get(key), `chapter ${key}`);

  describe('rule 1 — the deepest STARTED position', () => {
    it('resumes the deepest started chapter at its page and scroll offset', async () => {
      await expect(resumeService().resolveResume(mangaId('a'), CALLER)).resolves.toEqual({
        chapterId: chapterId('a2'),
        chapterNumber: 2,
        pageNumber: 7,
        scrollOffset: 0.25,
      });
    });

    it('ignores chapters that were never started', async () => {
      const result = await resumeService().resolveResume(mangaId('a'), CALLER);
      expect(result?.chapterId).not.toBe(chapterId('a3'));
    });
  });

  describe('rule 3 — anonymous is null, and not an error', () => {
    it('returns null for an anonymous caller with progress on file', async () => {
      queries = [];
      const result = await resumeService().resolveResume(mangaId('a'), null);
      expect(result).toBeNull();
    });

    it('issues no query at all for an anonymous caller', () => {
      expect(queries).toHaveLength(0);
    });
  });

  describe("rule 6 — one reader never sees another reader's position", () => {
    it('each caller gets its own row for the same chapter', async () => {
      const service = resumeService();
      await expect(service.resolveResume(mangaId('a'), CALLER)).resolves.toMatchObject({
        pageNumber: 7,
      });
      await expect(service.resolveResume(mangaId('a'), OTHER_CALLER)).resolves.toMatchObject({
        pageNumber: 15,
      });
    });

    it('the reader id used in the query is the session caller, nothing else', async () => {
      queries = [];
      await resumeService().resolveResume(mangaId('a'), OTHER_CALLER);
      expect(queries).toEqual([{ userId: otherId.value, mangaId: mangaId('a') }]);
    });
  });

  describe('rule 2 — a completed position advances to the next unread chapter', () => {
    it('returns the next unread chapter at page 1', async () => {
      await expect(resumeService().resolveResume(mangaId('b'), CALLER)).resolves.toEqual({
        chapterId: chapterId('b3'),
        chapterNumber: 3,
        pageNumber: 1,
        scrollOffset: 0,
      });
    });

    it('skips a draft chapter and a chapter with no committed pages', async () => {
      await expect(resumeService().resolveResume(mangaId('f'), CALLER)).resolves.toEqual({
        chapterId: chapterId('f4'),
        chapterNumber: 4,
        pageNumber: 1,
        scrollOffset: 0,
      });
    });
  });

  describe('rule 5 — edge cases', () => {
    it('all chapters complete → null', async () => {
      await expect(resumeService().resolveResume(mangaId('c'), CALLER)).resolves.toBeNull();
    });

    it('progress on a soft-deleted chapter falls back to the previous valid chapter', async () => {
      await expect(resumeService().resolveResume(mangaId('d'), CALLER)).resolves.toEqual({
        chapterId: chapterId('d1'),
        chapterNumber: 1,
        pageNumber: 4,
        scrollOffset: 0.5,
      });
    });

    it('a soft-deleted chapter that WAS the only started chapter → null', async () => {
      await expect(resumeService().resolveResume(mangaId('e'), CALLER)).resolves.toBeNull();
    });

    it('a deleted chapter between two completed ones does not resurrect one', async () => {
      await expect(resumeService().resolveResume(mangaId('g'), CALLER)).resolves.toBeNull();
    });

    it('never started → null', async () => {
      await expect(resumeService().resolveResume(mangaId('i'), CALLER)).resolves.toBeNull();
    });

    it('a manga with no published chapter → null (404-shaped, not an error)', async () => {
      await expect(resumeService().resolveResume(mangaId('j'), CALLER)).resolves.toBeNull();
    });

    it('EC-RDR-10: a stored page past the current page count clamps', async () => {
      await expect(resumeService().resolveResume(mangaId('h'), CALLER)).resolves.toEqual({
        chapterId: chapterId('h1'),
        // numeric(8,2) '10.5' survives the row → DTO mapping.
        chapterNumber: 10.5,
        pageNumber: 8,
        scrollOffset: 0,
      });
    });
  });

  describe('the query itself', () => {
    it('reads the chapters through an index, never a sequential scan (NFR-PERF-014)', async () => {
      // Which of the two candidate indexes the planner picks is a cost decision
      // (at fixture scale the partial `ix_chapters_visible` is smaller; on a
      // real catalogue `ix_chapters_manga_order` serves manga_id + the ORDER BY).
      // What NFR-PERF-014 actually requires is that the read is indexed at all,
      // so the plan is asserted instead of the comment.
      const nodes = planNodes(await explainResumeQuery());
      const chapterScan = nodes.find((n) => n['Relation Name'] === 'chapter');
      expect(chapterScan?.['Node Type']).toMatch(/^Index/);
      expect(chapterScan?.['Index Name']).toMatch(/^ix_chapters_(manga_order|visible)$/);
    });

    it("joins the caller's own progress through the (user_id, chapter_id) key", async () => {
      const nodes = planNodes(await explainResumeQuery());
      const progressScan = nodes.find((n) => n['Relation Name'] === 'reading_progress');
      expect(progressScan?.['Node Type']).toMatch(/^Index/);
      expect(progressScan?.['Index Name']).toBe(READING_PROGRESS_PK);
    });

    it('names the indexes it relies on, and they exist', async () => {
      const rows = await sql<{ indexname: string }[]>`
        select indexname from pg_indexes
        where tablename in ('chapter', 'reading_progress')
      `;
      const names = rows.map((r) => r.indexname);
      expect(names).toContain(READING_PROGRESS_PK);
      expect(names).toContain('ix_chapters_manga_order');
      expect(names).toContain('ix_chapters_visible');
    });
  });
});
