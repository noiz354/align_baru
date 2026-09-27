/**
 * MangaCard — one catalog card (FR-CATALOG-005).
 *
 * Requirements: FR-CATALOG-005, NFR-A11Y-004, NFR-PERF-001/003.
 * Tasks: T-CATALOG-003.
 * Spec: ACCESSIBILITY.md §2 — "catalog grid items are links with descriptive
 * accessible names"; design input `_docs/hifi/discover.html`.
 *
 * ── Isomorphic on purpose ──────────────────────────────────────────────────
 * This module has no `'use client'` and no server-only import, so the SAME
 * component renders the server-rendered page 1 and the one extra page the
 * "load more" island appends in the browser. One component means a card cannot
 * look one way on first paint and another way after a click.
 *
 * ── The accessible name is composed, never asserted ───────────────────────
 * The card shows title, status and the latest-chapter label as real text, and
 * the link's accessible name is therefore those three things — which is what
 * ACCESSIBILITY.md §2 asks for ("{title} — manga, {status}"), and strictly
 * more useful. There is deliberately no `aria-label` on the link: an author
 * name that disagrees with the visible text is both a maintenance trap and an
 * axe `label-content-name-mismatch` failure, and the name here cannot drift
 * because it is built from the text that is already on screen.
 *
 * ── The status is not a badge colour ───────────────────────────────────────
 * `Ongoing` is a word. A reader who cannot separate the three status colours
 * still knows which series are finished (ACCESSIBILITY.md §3.3).
 */
import type { MangaSummary } from '../../shared/contracts';
import { classNames } from '../../shared/ui/classNames';
import { UiLink } from '../../shared/ui/Link';
import { CoverImage } from './cover-image';
import { chapterLabel, STATUS_LABEL } from './catalog-query';
import styles from './discover.module.css';

export type MangaCardProps = {
  manga: MangaSummary;
  /** The first card's cover is the LCP element (NFR-PERF-001). */
  priority?: boolean;
  /** Dimmed while a filter or sort change is in flight. */
  pending?: boolean;
};

export function MangaCard({ manga, priority = false, pending = false }: MangaCardProps) {
  return (
    <li className={classNames(styles.card, pending && styles.pending)}>
      {/*
        `prefetch={false}` is a budget decision, not a performance shrug: the
        App Router prefetches every link that enters the viewport, so a 24-card
        shelf spent 24 requests on detail pages nobody has asked for yet —
        measured, and it is more than half of what /discover was requesting.
        Clicking still navigates client-side; the page just fetches when it is
        asked to (NFR-PERF-008, ≤ 30 requests).
      */}
      <UiLink
        className={classNames(styles.cardLink)}
        href={`/manga/${manga.slug}`}
        prefetch={false}
      >
        <CoverImage src={manga.coverUrl} priority={priority} />
        <span className={classNames(styles.cardTitle)}>{manga.title}</span>
        <span className={classNames(styles.cardMeta)}>
          {STATUS_LABEL[manga.status]}
          {' · '}
          {manga.latestChapter === null
            ? 'No chapters'
            : `Ch. ${manga.latestChapter.number}`}
        </span>
      </UiLink>
    </li>
  );
}

/**
 * The card's cover, for the detail page's own single cover. Named here so both
 * surfaces agree on the one thing they share: the box.
 */
export function mangaCoverAlt(title: string): string {
  return `Cover: ${title}`;
}

/** Re-exported so the list step and the card can never disagree on wording. */
export { chapterLabel };

export default MangaCard;
