/**
 * Unit tests — continue-reading (resume) resolution, the pure decision layer
 * of `features/progress` (T-CATALOG-009).
 *
 * Planned ID: **UNIT-PROG-004** ("sibling" of UNIT-PROG-003, the wording
 * T-CATALOG-009's Testing row uses). UNIT-PROG-003 itself is already allocated
 * in TEST_STRATEGY.md §2 to the sign-in merge (T-READER-023) and is asserted by
 * the merge task, and that table is outside this task's write scope — so the
 * resume rules take the next free id in the family. Recorded as a
 * spec-question (see `src/features/progress/resume.service.ts`).
 *
 * Level: UNIT (TEST_STRATEGY §1 — no I/O, no services). The rules are asserted
 * against a hand-built {@link ResumeSnapshot} with a fake
 * {@link ResumePositionReader}, which is the whole reason the decision is a
 * pure function and not SQL: the sibling integration test
 * (`tests/integration/progress.resume.test.ts`, INT-PROG-001 reuse) proves the
 * one query that produces the snapshot, this file proves the rules.
 *
 * Rules asserted (T-CATALOG-009 "Expected behavior" + "Edge cases"):
 *   1. the deepest STARTED position — completed chapters count as started
 *   2. completed manga → the next unread chapter, else null
 *   3. anonymous → null, and NOT an error (the reader is never even called)
 *   4. the return carries chapter id + chapter number + page + scroll offset
 *   5. deleted/unpublished/empty chapters are skipped (the snapshot only
 *      contains valid chapters, so this file proves the resolver walks PAST a
 *      hole rather than stopping at it); all complete → null
 *   6. EC-RDR-10 clamp: a stored page beyond the current page count clamps
 *
 * Fixtures here are shapes, not product data (AGENTS.md §4.3 — real rows live
 * in the seed harness and in the integration test).
 */
import { describe, expect, it } from 'vitest';
import {
  createResumeService,
  resolveResumePosition,
  type ResumeChapterFact,
  type ResumePositionReader,
  type ResumeSnapshot,
} from '../../src/features/progress/resume.service';
import type { CallerContext } from '../../src/shared/contracts';
import type { ChapterId, MangaId, UserId } from '../../src/shared/types';

const MANGA = '01930000-0000-7000-8000-0000000000aa' as MangaId;
const USER = '01930000-0000-7000-8000-0000000000bb' as UserId;
const OTHER_USER = '01930000-0000-7000-8000-0000000000cc' as UserId;

function chapterId(n: number): ChapterId {
  return `01930000-0000-7000-8000-0000000000${String(n).padStart(2, '0')}` as ChapterId;
}

/**
 * One chapter fact. `pageNumber: null` means "no reading_progress row" — the
 * chapter exists but was never started.
 */
function fact(
  readingOrder: number,
  opts: {
    chapterNumber?: number;
    pageCount?: number;
    pageNumber?: number | null;
    scrollPosition?: number;
    completed?: boolean;
  } = {},
): ResumeChapterFact {
  const started = opts.pageNumber === undefined ? null : opts.pageNumber;
  return {
    chapterId: chapterId(readingOrder),
    chapterNumber: opts.chapterNumber ?? readingOrder,
    readingOrder,
    pageCount: opts.pageCount ?? 20,
    position:
      started === null
        ? null
        : {
            pageNumber: started,
            scrollPosition: opts.scrollPosition ?? 0,
            completed: opts.completed ?? false,
          },
  };
}

function snapshot(...chapters: ResumeChapterFact[]): ResumeSnapshot {
  return { mangaId: MANGA, chapters };
}

/** The caller the route guard attaches; identity is frozen (data-flow.md §7). */
const CALLER: CallerContext = { userId: USER, role: 'reader' };

/** A fake port that counts its calls, so "never touched" is assertable. */
function fakeReader(chapters: readonly ResumeChapterFact[]) {
  const calls: Array<{ userId: UserId; mangaId: MangaId }> = [];
  const reads: ResumePositionReader = {
    async readResumeSnapshot(userId, mangaId) {
      calls.push({ userId, mangaId });
      return { mangaId, chapters };
    },
  };
  return { reads, calls };
}

describe('UNIT-PROG-004 — resume rules (T-CATALOG-009)', () => {
  describe('rule 1 — deepest STARTED position, not completed-only', () => {
    it('returns the deepest chapter that was started', () => {
      const result = resolveResumePosition(
        snapshot(
          fact(1, { pageNumber: 3 }),
          fact(2, { pageNumber: 7, scrollPosition: 0.25 }),
          fact(3), // never started — must not win
          fact(4),
        ),
      );
      expect(result).toEqual({
        chapterId: chapterId(2),
        chapterNumber: 2,
        pageNumber: 7,
        scrollOffset: 0.25,
      });
    });

    it('does not restrict the candidates to completed chapters', () => {
      // The deepest started chapter is INCOMPLETE; an earlier COMPLETED one
      // must not be preferred just because it is "done".
      const result = resolveResumePosition(
        snapshot(fact(1, { pageNumber: 20, completed: true }), fact(2, { pageNumber: 2 })),
      );
      expect(result?.chapterId).toBe(chapterId(2));
    });

    it('orders by reading order, not by the order the snapshot arrives in', () => {
      // Chapter 3 is the deepest but was never started, so the answer is
      // chapter 2 — an implementation that trusted arrival order (or that
      // took "last row wins") would answer 1 or 3 instead.
      const shuffled = [fact(3), fact(1, { pageNumber: 9 }), fact(2, { pageNumber: 4 })];
      expect(resolveResumePosition(snapshot(...shuffled))?.chapterId).toBe(chapterId(2));
    });

    it('returns null when nothing was started', () => {
      expect(resolveResumePosition(snapshot(fact(1), fact(2)))).toBeNull();
    });
  });

  describe('rule 2 — a completed position advances to the next unread chapter', () => {
    it('completed deepest → next unread chapter at page 1', () => {
      const result = resolveResumePosition(
        snapshot(
          fact(1, { pageNumber: 18, completed: true }),
          fact(2, { pageNumber: 20, completed: true }),
          fact(3),
        ),
      );
      expect(result).toEqual({
        chapterId: chapterId(3),
        chapterNumber: 3,
        pageNumber: 1,
        scrollOffset: 0,
      });
    });

    it('keeps the chapter number of a fractional chapter (10.5)', () => {
      const result = resolveResumePosition(
        snapshot(
          fact(1, { pageNumber: 20, completed: true }),
          fact(2, { chapterNumber: 10.5, pageNumber: 1 }),
        ),
      );
      expect(result?.chapterNumber).toBe(10.5);
    });
  });

  describe('rule 5 — edge cases', () => {
    it('all chapters complete → null (the detail page shows a "read" state)', () => {
      expect(
        resolveResumePosition(
          snapshot(
            fact(1, { pageNumber: 20, completed: true }),
            fact(2, { pageNumber: 20, completed: true }),
          ),
        ),
      ).toBeNull();
    });

    it('a hole in the middle is walked past, not stopped at', () => {
      // The repository never returns deleted/draft/empty chapters, so the
      // snapshot is sparse. The resolver must not assume contiguity.
      const result = resolveResumePosition(
        snapshot(fact(1, { pageNumber: 4 }), fact(9, { pageNumber: 11 })),
      );
      expect(result?.chapterId).toBe(chapterId(9));
    });

    it('a deleted (absent) chapter leaves the previous valid position standing', () => {
      // chapter 2 was soft-deleted after the reader finished it: it is not in
      // the snapshot, so chapter 1 — the previous VALID position — resumes.
      const result = resolveResumePosition(
        snapshot(fact(1, { pageNumber: 6, scrollPosition: 0.5 }), fact(3)),
      );
      expect(result).toEqual({
        chapterId: chapterId(1),
        chapterNumber: 1,
        pageNumber: 6,
        scrollOffset: 0.5,
      });
    });

    it('null snapshot (no readable chapter at all) → null', () => {
      expect(resolveResumePosition(null)).toBeNull();
    });

    it('an empty chapter list → null', () => {
      expect(resolveResumePosition(snapshot())).toBeNull();
    });

    it('EC-RDR-10: a stored page beyond the current page count clamps', () => {
      // Re-ingest shrank the chapter (20 → 8 pages); the raw row still says 14.
      const result = resolveResumePosition(snapshot(fact(1, { pageCount: 8, pageNumber: 14 })));
      expect(result?.pageNumber).toBe(8);
    });

    it('a non-finite / out-of-range scroll offset is normalized to 0..1', () => {
      const high = resolveResumePosition(snapshot(fact(1, { pageNumber: 2, scrollPosition: 4.2 })));
      const nan = resolveResumePosition(
        snapshot(fact(1, { pageNumber: 2, scrollPosition: Number.NaN })),
      );
      const low = resolveResumePosition(snapshot(fact(1, { pageNumber: 2, scrollPosition: -1 })));
      expect(high?.scrollOffset).toBe(1);
      expect(nan?.scrollOffset).toBe(0);
      expect(low?.scrollOffset).toBe(0);
    });
  });

  describe('rule 3 — anonymous is null, not an error', () => {
    it('resolves to null without touching the reader', async () => {
      const { reads, calls } = fakeReader([fact(1, { pageNumber: 5 })]);
      const service = createResumeService({ reads });
      await expect(service.resolveResume(MANGA, null)).resolves.toBeNull();
      expect(calls).toHaveLength(0);
    });

    it('an anonymous caller sees nothing even when progress exists', async () => {
      const { reads } = fakeReader([fact(1, { pageNumber: 5 })]);
      const service = createResumeService({ reads });
      expect(await service.resolveResume(MANGA, null)).toBeNull();
    });
  });

  describe('rule 6 — identity comes from the session caller only (IDOR-impossible)', () => {
    it('reads with the session user id and nothing else', async () => {
      const { reads, calls } = fakeReader([fact(1, { pageNumber: 3 })]);
      const service = createResumeService({ reads });
      const result = await service.resolveResume(MANGA, CALLER);
      expect(calls).toEqual([{ userId: USER, mangaId: MANGA }]);
      expect(result?.pageNumber).toBe(3);
    });

    it('an admin caller still reads only ITS OWN progress', async () => {
      const { reads, calls } = fakeReader([fact(1, { pageNumber: 3 })]);
      const service = createResumeService({ reads });
      await service.resolveResume(MANGA, { userId: OTHER_USER, role: 'admin' });
      expect(calls[0]?.userId).toBe(OTHER_USER);
      // The port takes a user id and a manga id. There is no "subject user"
      // parameter anywhere in the signature, so there is no value an attacker
      // could substitute to read another reader's position.
    });

    it('the ProgressReader port shape (used by the catalog service) is satisfied', async () => {
      const { reads } = fakeReader([fact(1, { pageNumber: 8, scrollPosition: 0.1 })]);
      const service = createResumeService({ reads });
      // catalog.service.ts declares `progress: import('../progress').ProgressReader`
      // (T-CATALOG-002's wiring) and calls latestForManga(userId, mangaId).
      const asPort = service as unknown as {
        latestForManga(u: UserId, m: string): Promise<unknown>;
      };
      await expect(asPort.latestForManga(USER, MANGA)).resolves.toEqual({
        chapterId: chapterId(1),
        chapterNumber: 1,
        pageNumber: 8,
        scrollOffset: 0.1,
      });
    });
  });
});
