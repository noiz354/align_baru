/**
 * ChapterList — the reading order, as a real list (T-CATALOG-008).
 *
 * Requirements: FR-CATALOG-007, FR-CHAPTER-004, NFR-A11Y-004, NFR-A11Y-008.
 * Tasks: T-CATALOG-008 (list), T-CATALOG-007 (the API behind it).
 * Spec: ACCESSIBILITY.md §2 ("chapter lists are real ul/ol with li"), §3.3 (no
 * information by colour alone), TASKS.md T-CATALOG-008.
 *
 * ── What is on a row, and why ─────────────────────────────────────────────
 * number · title · page count · published date. That is FR-CATALOG-007, all of
 * it, and each is TEXT: a page count a reader compares across rows is set in
 * tabular mono (`.num`) so the column lines up, because a 240-page omnibus and
 * a 19-page chapter must be scannable as a column and not as prose.
 *
 * The number appears twice — once as the row's own text, once as the `<ol>`'s
 * implicit marker — on purpose: the list is in `reading_order`, so its counting
 * agrees with the printed number, and a screen reader that says "1 of 220"
 * next to "Chapter 1" is agreeing with itself. A newest-first list would have
 * needed `reversed` and a marker that contradicts the visible number; the
 * "Latest" label does that job instead (see the page).
 *
 * ── 200+ rows, rendered in full (T-CATALOG-008 expected behavior 2) ───────
 * No virtualization: the API caps a title at 1000 chapters, and a 200-row list
 * of links is a document, not a feed. The cost that does need managing is
 * scroll jank, so the rows carry `content-visibility: auto` with an
 * `contain-intrinsic-size` hint — the browser skips layout and paint for
 * off-screen rows while keeping their box the right height, which is what keeps
 * the scrollbar honest. Nothing is removed from the DOM and no tab stop is lost.
 *
 * ── Drafts ─────────────────────────────────────────────────────────────────
 * A row with no `publishedAt` is a draft (shared/contracts/chapter.ts). It is
 * labelled with the WORD "Draft" in a dashed badge — a provisional row looks
 * provisional, and a sighted reader can tell a draft from a published chapter
 * without a legend. Non-admins never receive drafts: `includeDrafts` is only
 * sent by the admin caller, and no session exists yet
 * (TODO(T-AUTH-003) — the caller is anonymous, so the parameter is not sent
 * and the API's admin-only rule does the rest). The label is implemented and
 * tested; the request that produces a draft row is the admin lane's.
 *
 * ── The read/unread indicator is NOT here ──────────────────────────────────
 * T-CATALOG-008 asks for one (icon + count, never colour alone — §3.3) and
 * depends on T-LIB-006 (VS-5) for the data, which has not landed: the chapter
 * payload has no read state, so there is nothing to render. Rendering a guessed
 * dot would be a badge that lies about the reader's own history. The
 * two-phase state is therefore: absent now, and the E2E asserts its absence so
 * the day arrives by implementation rather than by improvisation.
 * TODO(T-LIB-006, T-CATALOG-008): add the indicator here, with an icon AND a
 * count, and a text alternative for both.
 */
import type { ChapterSummary } from '../../../shared/contracts';
import { classNames } from '../../../shared/ui/classNames';
import { UiLink } from '../../../shared/ui/Link';
import { chapterLabel } from '../../discover/catalog-query';
import { chapterSegment, dateTime, formatDate } from './manga-format';
import styles from './manga-detail.module.css';

export type ChapterListProps = {
  /** The manga's slug — the reader route is `/manga/{slug}/chapter/{number}`. */
  slug: string;
  chapters: readonly ChapterSummary[];
  /** The count the detail header states (FR-CATALOG-006). */
  totalCount: number;
  /** True when the chapter list itself could not be read. */
  unavailable: boolean;
};

export function ChapterList({ slug, chapters, totalCount, unavailable }: ChapterListProps) {
  const published = chapters.filter((chapter) => chapter.publishedAt !== null);
  const latestNumber =
    published.length === 0 ? null : (published[published.length - 1]?.number ?? null);

  if (unavailable) {
    return (
      <p className={styles.notice} role="status">
        The chapter list could not be loaded just now. The title, its synopsis and its first
        chapter are still here.
      </p>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className={styles.state}>
        <h3>No chapters yet</h3>
        <p>
          Nothing is published for this title{totalCount > 0 ? ` yet (${totalCount} counted)` : ''}
          . An admin publishes chapters from the admin panel; the catalog never shows an
          unpublished one.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className={styles.chapterCount}>
        <span className="num">{chapters.length}</span>{' '}
        {chapters.length === 1 ? 'chapter' : 'chapters'} in reading order
        {totalCount > chapters.length ? ` · ${totalCount} in total` : ''}
      </p>
      <nav aria-label="Chapters">
        {/*
          The list is named by the section's own heading rather than given a
          second name, so the heading and the list cannot drift apart.
        */}
        <ol className={styles.chapters} aria-labelledby="detail-chapters-h">
          {chapters.map((chapter) => {
            const isDraft = chapter.publishedAt === null;
            return (
              <li key={chapter.id} className={styles.chapterRow}>
                <span className={classNames(styles.chapterNum, 'num')}>{chapter.number}</span>
                <span className={styles.chapterBody}>
                  {/*
                    No `aria-label` here, on purpose. The row's own text is
                    already a complete name — "Chapter 12 — The Long Repair, 26
                    pages, 2026-01-04" — and an author-supplied name that has
                    to be re-derived from the visible text is a place where the
                    two can drift apart (and where axe
                    `label-content-name-mismatch` fires). A draft row simply has
                    no date, and the word "Draft" sits beside it as a badge that
                    is part of the row.
                  */}
                  {/*
                    `prefetch={false}`: a 220-row list prefetching 220 reader
                    routes on scroll is the single largest request fan-out this
                    page could have (measured: 34 prefetches on a 24-card shelf
                    alone). The reader's own route is T-READER-001's.
                  */}
                  <UiLink
                    className={classNames(styles.chapterLink)}
                    href={`/manga/${slug}/chapter/${chapterSegment(chapter.number)}`}
                    prefetch={false}
                  >
                    {chapterLabel(chapter.number)}
                    {chapter.title === null || chapter.title === '' ? null : (
                      <span className={styles.chapterTitle}> — {chapter.title}</span>
                    )}
                  </UiLink>
                  <span className={styles.chapterMeta}>
                    <span className="num">{chapter.pageCount}</span>{' '}
                    {chapter.pageCount === 1 ? 'page' : 'pages'}
                    {isDraft ? null : (
                      <>
                        {' · '}
                        <time dateTime={dateTime(chapter.publishedAt)}>
                          {formatDate(chapter.publishedAt)}
                        </time>
                      </>
                    )}
                  </span>
                </span>
                <span className={styles.chapterFlags}>
                  {isDraft ? (
                    <span className={styles.badgeDraft}>Draft</span>
                  ) : chapter.number === latestNumber ? (
                    <span className={styles.badge}>Latest</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * What a row states, in one place, so the visible text and anything that ever
 * describes it are written from the same values: the chapter, its title, its
 * page count, and — for a published chapter — its date.
 */
export function chapterRowLabel(chapter: ChapterSummary): string {
  const title = chapter.title === null || chapter.title === '' ? '' : `, ${chapter.title}`;
  const pages = `${chapter.pageCount} ${chapter.pageCount === 1 ? 'page' : 'pages'}`;
  if (chapter.publishedAt === null) {
    return `${chapterLabel(chapter.number)}${title}, draft, ${pages}`;
  }
  return `${chapterLabel(chapter.number)}${title}, ${pages}, published ${formatDate(chapter.publishedAt)}`;
}

export default ChapterList;
