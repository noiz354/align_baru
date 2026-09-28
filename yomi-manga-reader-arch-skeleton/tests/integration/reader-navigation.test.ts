/**
 * Chapter navigation in the reader (INT-RDR-NAV, F-007-S1).
 *
 * The gap
 * -------
 * `ChapterRepository.pageList` has returned the prev/next published neighbours
 * since FR-READER-016 was implemented, and the `/pages` route has returned them
 * since F-006-S2 rewired it. The reader declared its OWN local
 * `ChapterPagesResponse` without those two fields, so the response carried them
 * and the client silently dropped them. A reader finished a chapter and had to
 * walk back to the manga page to continue — and had no way to know whether more
 * chapters existed at all.
 *
 * Why this test parses the client source rather than mounting the component
 * ---------------------------------------------------------------------
 * A React Server Component test would need a DOM, a router, a fetch stub and a
 * full chapter fixture, and would still be asserting markup. What is actually at
 * risk here is a SHAPE MISMATCH between the contract the server sends and the type
 * the client parses — and that is a question about the two declarations agreeing.
 * The assertions below read the client and the contract and compare them, so a
 * field added to one and forgotten in the other fails the build.
 *
 * The mount-level behaviour that source cannot prove — that a click navigates —
 * is browser work and is recorded as a gap rather than claimed here.
 *
 * Requirements: FR-READER-016
 * Tasks: T-READER-001
 *
 * No DSN required: nothing here touches a database.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `resolve` rather than `new URL(..., import.meta.url)`: the reader's path
// contains `[slug]` and `[chapter]`, and square brackets are not valid URL
// characters — the URL parser rewrites them and the file is never found. The
// first version of this test failed to load for exactly that reason.
const here = dirname(fileURLToPath(import.meta.url));
const CLIENT = resolve(here, '../../src/app/manga/[slug]/chapter/[chapter]/reader-client.tsx');
const CONTRACT = resolve(here, '../../src/shared/contracts/chapter.ts');

const client = readFileSync(CLIENT, 'utf8');
const contract = readFileSync(CONTRACT, 'utf8');

describe('the reader consumes the chapter neighbours (INT-RDR-NAV, F-007-S1)', () => {
  it('parses the shared contract type rather than a local copy of it', () => {
    // The bug's shape: a locally-declared response interface drifted from the
    // contract, and the drift was invisible because nothing compared them. The
    // client now imports the contract's own type, so a field added to the
    // contract is visible in the client at compile time.
    expect(client).toMatch(/from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/shared\/contracts\/chapter'/);
    expect(client).toMatch(/import type \{[^}]*ChapterPagesResponse/);

    // And the two local redeclarations that made the drift possible are gone.
    expect(client).not.toMatch(/^interface ChapterPagesResponse \{/m);
    expect(client).not.toMatch(/^interface PageAsset \{/m);
  });

  it('reads BOTH neighbours off the response', () => {
    expect(client).toMatch(
      /readNeighbour\(\(parsed as \{ prevChapter\?: unknown \}\)\.prevChapter\)/,
    );
    expect(client).toMatch(
      /readNeighbour\(\(parsed as \{ nextChapter\?: unknown \}\)\.nextChapter\)/,
    );
    expect(client).toMatch(/setPrevChapter\(/);
    expect(client).toMatch(/setNextChapter\(/);
  });

  it('treats null, a missing field and a malformed neighbour as "no neighbour"', () => {
    // At the ends of a manga the contract says `null`, and a response that omits
    // the field must not crash the reader. All three collapse to the same answer,
    // so a broken neighbour becomes an absent control rather than a link that
    // goes nowhere.
    expect(client).toMatch(/function readNeighbour\(raw: unknown\): ChapterNeighbour \| null/);
    // The raw guard is the one that prevents a THROW, not merely a wrong value:
    // without it, `raw as Record<string, unknown>` is undefined and indexing it
    // raises. A response that omits `prevChapter` entirely hits exactly this.
    // It was the guard the first version of this test did NOT assert — and the
    // one a mutation removed without failing anything.
    expect(client).toMatch(/if \(typeof raw !== 'object' \|\| raw === null\) return null;/);
    expect(client).toMatch(/if \(typeof slug !== 'string' \|\| slug === ''\) return null/);
    expect(client).toMatch(/typeof number !== 'number' \|\| !Number\.isFinite\(number\)/);
  });

  it('builds the neighbour href from the slug and number the contract carries', () => {
    // `MangaSlug` and the chapter number are the whole of the neighbour's
    // identity; `mangaTitle` is not in the neighbour because the slug carries it.
    expect(contract).toMatch(
      /prevChapter: \{ slug: MangaSlug; number: number; title: string \| null \} \| null/,
    );
    expect(contract).toMatch(
      /nextChapter: \{ slug: MangaSlug; number: number; title: string \| null \} \| null/,
    );
    expect(client).toMatch(
      /hrefFor = \(n: ChapterNeighbour\) => `\/manga\/\$\{n\.slug\}\/chapter\/\$\{n\.number\}`/,
    );
  });

  it('navigates with a real link, not a scripted route change', () => {
    // A `<button>` with a router push would be keyboard-reachable but not
    // middle-clickable, not openable in a new tab, and not copy-linkable — all of
    // which a reader expects from "the next chapter". A plain `href` gets them for
    // free and costs nothing.
    expect(client).toMatch(/<a[\s\S]{0,200}href=\{hrefFor\(prevChapter\)\}/);
    expect(client).toMatch(/<a[\s\S]{0,200}href=\{hrefFor\(nextChapter\)\}/);
    // Each carries a name that says which chapter, not just "next".
    expect(client).toMatch(/aria-label=\{`Previous chapter: /);
    expect(client).toMatch(/aria-label=\{`Next chapter: /);
    // And they live in a landmark, so a screen reader can jump to them.
    expect(client).toMatch(/<nav\s+aria-label="Chapter navigation"/);
  });

  it('shows an honest absence rather than a dead control', () => {
    expect(client).toMatch(/No previous chapter/);
    expect(client).toMatch(/No next chapter/);
  });

  it('no longer claims chapter navigation is missing', () => {
    // The header listed it as a gap. A gap list that keeps a fixed item is the
    // kind of stale record this project has been deleting all session.
    expect(client).not.toMatch(/Previous\/next CHAPTER\. The chapter list is fetched ONLY/);
    // `T-READER-016` (task) and `FR-READER-016` (requirement), not `F-READER-016` —
    // which is a substring of neither. The first version of this assertion used
    // that form and failed against a header that was correct.
    expect(client).toMatch(/FR-READER-016/);
    expect(client).toMatch(/T-READER-016/);
  });
});
