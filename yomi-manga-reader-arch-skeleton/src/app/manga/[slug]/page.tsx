/**
 * Manga detail (`/manga/[slug]`) — every FR-CATALOG-006 field, and the
 * chapter list (T-CATALOG-008).
 *
 * Requirements: FR-CATALOG-006/007, FR-CHAPTER-002, NFR-SEC-016, NFR-A11Y-004,
 * NFR-PERF-001/003/008. Tasks: T-CATALOG-006 (detail), T-CATALOG-008 (list).
 * Spec: PRD §6.2, ACCESSIBILITY.md §2/§4, API_CONTRACT §2.1.
 *
 * ── Landmarks and headings (ACCESSIBILITY.md §2/§4) ────────────────────────
 *   nav[aria-label=Breadcrumb]  — "Catalog / {title}" (§4 requires breadcrumbs on
 *                                 detail pages)
 *   main                        — AppShell's single <main>
 *   nav[aria-label=Chapters]    — a chapter list is navigation, so it is a nav
 *   h1                          — the manga title, the page's only h1
 *   h2                          — Synopsis, Chapters. No level is skipped.
 *
 * ── Unpublished, deleted, unknown → the real 404 ──────────────────────────
 * `notFound()` renders `src/app/not-found.tsx`, the same page an unknown route
 * gets, and the wording cannot distinguish the cases on purpose (THREAT T-04:
 * "no such manga" and "you may not see this manga" are the same sentence to an
 * attacker). A title that exists but cannot be read right now is NOT a 404 — it
 * gets DetailUnavailable, because "your bookmark is dead" would be a lie.
 *
 * ── The synopsis is TEXT (NFR-SEC-016, THREAT T-01) ───────────────────────
 * Stored as plain text, validated as a string, rendered as text nodes. No
 * markdown parser, no sanitizer, no `dangerouslySetInnerHTML` anywhere on this
 * page: markup could only reach the DOM through a React bug, not a payload. An
 * empty synopsis hides the whole section rather than leaving an empty heading
 * (T-CATALOG-006 edge case).
 *
 * ── Reading order is ascending (FR-CATALOG-007) ───────────────────────────
 * The chapter list is a real `<ol>` in `reading_order` and each row states its
 * own number, so the list's implicit counting agrees with the printed number.
 * The hi-fi set drew it newest-first; the requirement says "in reading order" and
 * the API orders by `reading_order` (DATA_MODEL §9), so the requirement wins
 * (AGENTS.md §6) and the newest chapter is marked with a "Latest" label instead
 * of by being moved to the top. A reversed list would also have made the
 * `<ol>`'s own marker contradict the numbers on screen.
 *
 * ── Two-phase state, implemented honestly ──────────────────────────────────
 *   - The continue-reading entry (FR-CATALOG-008, T-CATALOG-009) is ABSENT:
 *     the data does not exist and `MangaDetail.continueReading` is not in the
 *     parsed contract yet. So the primary action says what it does — read
 *     chapter 1 — rather than promising a resume it cannot offer.
 *   - The read/unread indicator on chapter rows is ABSENT: T-LIB-006 (VS-5)
 *     owns the data and the payload has no such field.
 *   Both are named TODO markers so the next agent inherits the decision.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { readChapterList, readMangaDetail } from '../../discover/catalog-data';
import { CoverImage } from '../../discover/cover-image';
import { chapterLabel, STATUS_LABEL } from '../../discover/catalog-query';
import { UiLink } from '../../../shared/ui/Link';
import { ChapterList } from './chapter-list';
import { DetailUnavailable } from './detail-unavailable';
import { chapterSegment, dateTime, formatDate, synopsisExcerpt } from './manga-format';
import styles from './manga-detail.module.css';

/** Next 16: params arrive as a promise. */
type Params = Promise<{ slug: string }>;

/**
 * A malformed slug is a 404, not a crash (T-FOUND-003: "malformed params never
 * crash the layout"). The API validates the format and answers 422; this keeps
 * an obviously-bad path from ever becoming a request.
 */
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}._~-]{0,189}$/u;

/**
 * The title a 404 carries. It is `not-found.tsx`'s own `metadata.title`, kept
 * as one constant so the document title and the rendered body cannot drift —
 * which is exactly what happened when this returned a generic 'Manga'.
 */
const NOT_FOUND_METADATA: Metadata = { title: 'Page not found' };

/**
 * HTML is `no-store` (PERFORMANCE.md §7): a title published a minute ago has to
 * be visible now. Stated explicitly rather than left to the read, because the
 * read also opts out of caching and the two are different decisions.
 */
export const dynamic = 'force-dynamic';

/**
 * The page is named by its title. The read is shared with the page below
 * through React's request cache, so the two can never disagree and the title
 * costs no second trip to the database (NFR-PERF-004).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  // A 404 must be TITLED as a 404. This segment's metadata wins over the
  // not-found boundary's, so a generic 'Manga' here left the document title
  // reading "Manga · Yomi" on a page whose body says "Page not found" — a
  // misdescribed page (WCAG 2.4.2), and one a screen reader announces as a
  // title that does not exist. The name comes from the same boundary the body
  // comes from, so the two cannot disagree.
  if (!SLUG.test(slug)) return NOT_FOUND_METADATA;
  const manga = await readMangaDetail(slug);
  if (!manga.ok) {
    return manga.failure === 'not-found' ? NOT_FOUND_METADATA : { title: 'Manga' };
  }
  return { title: manga.data.title, description: synopsisExcerpt(manga.data.synopsis) };
}

export default async function MangaDetailPage({ params }: { params: Params }) {
  const { slug } = await params;

  if (!SLUG.test(slug)) notFound();

  const detail = await readMangaDetail(slug);

  // MANGA_NOT_FOUND — which the API also returns for unpublished and
  // soft-deleted titles, so this branch can never become an existence oracle.
  if (!detail.ok && detail.failure === 'not-found') notFound();

  if (!detail.ok) {
    return (
      <div className={styles.stack}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <ol className={styles.crumbList}>
            <li>
              <UiLink href="/discover">Catalog</UiLink>
            </li>
          </ol>
        </nav>
        <DetailUnavailable labelledBy="detail-unavailable-h" retryHref={`/manga/${slug}`} />
      </div>
    );
  }

  const manga = detail.data;
  // Started only once the title is known: a title that does not exist has no
  // chapters to ask for, and asking anyway would be an existence probe.
  const chapters = await readChapterList(slug);

  const synopsis = manga.synopsis.trim();
  const first = manga.firstChapter;
  const latest = manga.latestChapter;
  // FR-CATALOG-008 / T-CATALOG-009. Absent for an anonymous reader and absent
  // for a reader with no position yet — the same wire answer, so the page has
  // one state to render. See the note on the action row below.
  const resume = manga.continueReading ?? null;
  const readerBase = `/manga/${manga.slug}/chapter`;

  return (
    <div className={styles.stack}>
      {/* ACCESSIBILITY.md §4: breadcrumbs on detail pages. */}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol className={styles.crumbList}>
          <li>
            <UiLink href="/discover">Catalog</UiLink>
          </li>
          <li aria-current="page">{manga.title}</li>
        </ol>
      </nav>

      <div className={styles.hero}>
        <div className={styles.heroCover}>
          {/*
            A standalone cover, not inside a link, so ACCESSIBILITY.md §3.2's
            `alt="Cover: {title}"` applies literally. The grid card cannot use
            it without announcing every title twice.
          */}
          <CoverImage src={manga.coverUrl} alt={`Cover: ${manga.title}`} priority />
        </div>

        <div className={styles.heroBody}>
          <h1>{manga.title}</h1>

          {/*
            Aliases as one wrapped line, not a truncated one: "many aliases, no
            overflow" is T-CATALOG-006's edge case.
          */}
          {manga.aliases.length === 0 ? null : (
            <p className={styles.meta}>
              <span className={styles.metaLabel}>Also known as</span>{' '}
              <span>{manga.aliases.join(' · ')}</span>
            </p>
          )}

          <dl className={styles.figures}>
            <div>
              <dt>Status</dt>
              {/* The label, not the stored value: "Ongoing" is a word a reader
                  parses, "ongoing" is a column value (STATUS_LABEL is shared
                  with the catalog card, so the two can never disagree). */}
              <dd>{STATUS_LABEL[manga.status]}</dd>
            </div>
            <div>
              <dt>Chapters</dt>
              <dd>{manga.chapterCount}</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>{manga.readingDirection === 'rtl' ? 'Right to left' : 'Left to right'}</dd>
            </div>
            <div>
              <dt>Added</dt>
              <dd>
                <time dateTime={dateTime(manga.createdAt)}>{formatDate(manga.createdAt)}</time>
              </dd>
            </div>
          </dl>

          <p className={styles.meta}>
            <span className={styles.metaLabel}>Creators</span>{' '}
            <span>
              {manga.creators.length === 0
                ? 'Not recorded'
                : manga.creators.map((c) => `${c.name} (${c.role})`).join(', ')}
            </span>
          </p>

          {manga.genres.length === 0 ? null : (
            <p className={styles.meta}>
              <span className={styles.metaLabel}>Genres</span>{' '}
              <span>{manga.genres.map((genre) => genre.name).join(', ')}</span>
            </p>
          )}

          {manga.tags.length === 0 ? null : (
            <p className={styles.meta}>
              <span className={styles.metaLabel}>Tags</span>{' '}
              <span>{manga.tags.map((tag) => tag.name).join(', ')}</span>
            </p>
          )}

          <p className={styles.actions}>
            {/*
              FR-CATALOG-006: the primary action opens chapter 1 — and for a
              one-chapter title, chapter 1 IS the latest chapter, so the two
              links below are the same link and only one is rendered.

              FR-CATALOG-008 / T-CATALOG-009: a reader WITH a position gets
              Resume as the primary action, and starting over becomes the
              secondary. Both are real links carrying the chapter in their
              accessible name, so the choice is never colour-only
              (ACCESSIBILITY.md §3.3), and the page number is spelled out rather
              than implied.
            */}
            {first === null ? (
              <span className={styles.meta}>Nothing is readable yet.</span>
            ) : resume === null ? (
              <UiLink
                className="btn btn--primary"
                href={`${readerBase}/${chapterSegment(first.number)}`}
              >
                {`Read ${chapterLabel(first.number)}`}
              </UiLink>
            ) : (
              <>
                <UiLink
                  className="btn btn--primary"
                  href={`${readerBase}/${chapterSegment(resume.chapterNumber)}`}
                >
                  {`Continue ${chapterLabel(resume.chapterNumber)} — page ${String(
                    resume.pageNumber,
                  )}`}
                </UiLink>
                {/* Only when it is a DIFFERENT chapter: resuming chapter 1 and
                    "start from chapter 1" are one link, and two buttons for one
                    destination is a keyboard trap with no meaning. */}
                {resume.chapterNumber === first.number ? null : (
                  <UiLink className="btn" href={`${readerBase}/${chapterSegment(first.number)}`}>
                    {`Start from ${chapterLabel(first.number)}`}
                  </UiLink>
                )}
              </>
            )}
            {latest === null || latest.number === first?.number ? null : (
              <UiLink className="btn" href={`${readerBase}/${chapterSegment(latest.number)}`}>
                {`Latest: ${chapterLabel(latest.number)}`}
              </UiLink>
            )}
          </p>
        </div>
      </div>

      {synopsis === '' ? null : (
        <section className={styles.section} aria-labelledby="detail-synopsis-h">
          <h2 id="detail-synopsis-h">Synopsis</h2>
          {/*
            Plain text, one <p> per blank-line-separated block. `pre-line` keeps
            an author's single line breaks inside a block; nothing is ever
            interpreted as markup (NFR-SEC-016).
          */}
          <div className={styles.prose}>
            {synopsis
              .split(/\n{2,}/)
              .map((block) => block.trim())
              .filter((block) => block !== '')
              .map((block, index) => (
                <p key={index}>{block}</p>
              ))}
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="detail-chapters-h">
        <h2 id="detail-chapters-h">Chapters</h2>
        <ChapterList
          slug={manga.slug}
          chapters={chapters.ok ? chapters.data : []}
          totalCount={manga.chapterCount}
          unavailable={!chapters.ok}
        />
      </section>
    </div>
  );
}
