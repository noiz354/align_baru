/**
 * Single-part chapter ingest (T-UPLOAD-006, F-017-S1).
 *
 * What this file WAS
 * ------------------
 * The resumable multi-part pipeline driver: a job state machine (queued →
 * validating → processing → ready/failed) with a watchdog, advisory locks and
 * an exactly-once handoff, built on the `upload_job` table. That pipeline is
 * REPLACED, not completed ([MASTER_PLAN.md](MASTER_PLAN.md)): the seed already
 * populates a catalogue, so resumable uploads are not needed to USE Yomi, and
 * a job table with no worker is machinery without a purpose. `upload_job`
 * stays untouched in the schema; `prepare-chapter-upload.ts` still throws
 * `T-UPLOAD-014` and `image-processor.ts` still throws `T-UPLOAD-004` — that is
 * recorded, not hidden.
 *
 * What this file IS
 * -----------------
 * One function that takes page images and lands a chapter: validate →
 * normalise → store objects → write `chapter_page` rows → optionally publish.
 * Single-part, synchronous, no jobs, no staging area, no worker. A curator
 * ingesting a chapter waits for the answer rather than polling a job — and at
 * ≤ 200 pages (PERFORMANCE.md §9) that wait is seconds, not minutes.
 *
 * The four phases, and why they run in this order
 * -----------------------------------------------
 * 1. VALIDATE everything before touching anything: the chapter exists
 *    (`CHAPTER_NOT_FOUND`, checked first so a typo is a 404 and never an FK
 *    500), the page list is non-empty (`UPLOAD_NO_IMAGES`) and within the cap
 *    (`UPLOAD_TOO_MANY_FILES`).
 * 2. NORMALISE every page before storing any: `media.normalize` decodes,
 *    strips metadata and encodes all three variants. A decode failure
 *    (`UPLOAD_IMAGE_DECODE`) here leaves zero objects behind, because nothing
 *    has been stored yet — the pure phase is the rollback strategy.
 * 3. STORE all variants, then 4. COMMIT the rows in ONE transaction
 *    (`ChapterRepository.commitPages`). If the commit fails, the stored objects
 *    are purged best-effort: the acceptance is "no partial rows", and orphaned
 *    objects are the same failure one layer down, so the purge is part of the
 *    function, not a cleanup job that may never run.
 *
 * Keys follow the contract the seed established — `pages/{chapterId}/{32-hex}`
 * per variant — through the ONE implementation (`pageObjectKey`), not a second
 * copy of the rule. The asset key is 32 hex chars from the CSPRNG: random, not
 * sequential, so a key from one ingest tells nothing about the next, and
 * content-addressing is explicitly NOT the scheme (two identical pages stored
 * twice is correct — deduplication would couple unrelated chapters' lifetimes).
 *
 * Publish is the admin chapter transition, not a flag here: after commit the
 * chapter has pages, so `publish: true` runs the same
 * `AdminChapterRepository.setPublishState` the admin service uses — first
 * publish stamps, and the stamp rule is that port's, not this function's.
 *
 * Requirements: FR-UPLOAD-001/002/003/005/011, NFR-SEC-008/015, DATA_MODEL §10.
 * Tasks: T-UPLOAD-001/003/004/005/006.
 */
import { randomBytes } from 'node:crypto';
import { AppError } from '../../shared/contracts/errors';
import type { Caller } from '../../shared/contracts';
import type { ImageProcessorPort, ObjectStoragePort } from '../../shared/contracts/ports';
import type { AssetKey } from '../../shared/types';
import { pageObjectKey } from '../../shared/storage-keys';
import type { AdminChapterRepository } from '../admin/admin-ports';
import type { ChapterRepository } from '../chapters/chapters.repository';
import type { AuditSink } from '../../shared/contracts/ports';
import type { ChapterId } from '../../shared/types';

/** PERFORMANCE.md §9: a 200-page job is the reference wall-clock budget. */
export const INGEST_MAX_PAGES = 200;

export interface IngestInput {
  chapterId: ChapterId;
  /** Page images IN ORDER, one entry per page. */
  pages: Array<{ bytes: Uint8Array; sourceFormat: string }>;
  /** Publish after commit (the admin transition, not a flag). */
  publish: boolean;
}

export interface IngestService {
  ingestChapterPages(
    caller: Caller,
    input: IngestInput,
  ): Promise<{ pageCount: number; published: boolean }>;
}

/**
 * One chunk as an async stream. `putStream` takes an async iterable, and a
 * bare array is not one — `for await` would accept it, but the TYPE is the
 * contract, and the contract says async.
 */
async function* one(chunk: Uint8Array): AsyncGenerator<Uint8Array> {
  yield chunk;
}

/**
 * The factory (T-UPLOAD-006, F-017-S1). The NAME is the old driver's, kept so
 * the acceptance ("`createUploadPipeline` no longer throws") is literally
 * true; what it builds is the replacement, and the header above says so.
 */
export function createUploadPipeline(deps: {
  storage: ObjectStoragePort;
  media: ImageProcessorPort;
  chapters: ChapterRepository;
  adminChapters: AdminChapterRepository;
  audit: AuditSink;
}): IngestService {
  const { storage, media, chapters, adminChapters, audit } = deps;

  return {
    async ingestChapterPages(caller, input) {
      if (caller.role !== 'admin') throw new AppError('AUTH_FORBIDDEN');
      const chapterId = input.chapterId;

      // Phase 1: validate everything before touching anything.
      const existing = await chapters.byId(chapterId, caller);
      if (existing === null) throw new AppError('CHAPTER_NOT_FOUND');
      if (input.pages.length === 0) throw new AppError('UPLOAD_NO_IMAGES');
      if (input.pages.length > INGEST_MAX_PAGES) throw new AppError('UPLOAD_TOO_MANY_FILES');

      // Phase 2: normalise every page before storing any. A decode failure
      // here (`UPLOAD_IMAGE_DECODE`, from the port contract) leaves zero
      // objects behind — the pure phase IS the rollback strategy.
      const normalised = [];
      for (let index = 0; index < input.pages.length; index += 1) {
        const page = input.pages[index] as IngestInput['pages'][number];
        const out = await media.normalize(page.bytes, page.sourceFormat);
        normalised.push({ ...out, assetKey: randomBytes(16).toString('hex') });
      }

      // Phase 3: store all variants. Keys collected for the purge below.
      const stored: AssetKey[] = [];
      const purge = async (): Promise<void> => {
        // Best-effort and SWALLOWED: the original failure is what the caller
        // must see, and a delete that fails here is a storage problem the
        // ingest cannot fix by reporting it twice. Orphans are observable
        // (the keys are returned in no success path, so anything stored by a
        // failed ingest is, by definition, unreferenced) and reclaimed by the
        // storage lifecycle, not by failing louder.
        for (const key of stored) {
          try {
            await storage.delete(key);
          } catch {
            // Deliberately nothing. See above.
          }
        }
      };
      try {
        for (const page of normalised) {
          for (const format of ['avif', 'webp', 'jpeg'] as const) {
            const key = pageObjectKey(chapterId, page.assetKey, format);
            const bytes = page[format];
            await storage.putStream(key, one(bytes), `image/${format}`);
            stored.push(key);
          }
        }
      } catch (cause) {
        await purge();
        throw cause;
      }

      // Phase 4: commit the rows in ONE transaction. On failure the objects go
      // with it — "no partial rows" and "no orphaned objects" are the same
      // acceptance at two layers.
      try {
        await chapters.commitPages({
          chapterId,
          pages: normalised.map((page, index) => ({
            pageNumber: index + 1,
            assetKey: page.assetKey,
            width: page.width,
            height: page.height,
            byteSizeAvif: page.avif.byteLength,
            byteSizeWebp: page.webp.byteLength,
            byteSizeJpeg: page.jpeg.byteLength,
          })),
          replace: true,
        });
      } catch (cause) {
        await purge();
        throw cause;
      }

      let published = false;
      if (input.publish) {
        // The chapter has pages now, so the readiness gate passes by
        // construction — and `setPublishState` stamps first publish itself.
        const now = new Date().toISOString();
        await adminChapters.setPublishState(chapterId, 'published', now);
        published = true;
      }

      await audit.append({
        actorId: caller.userId,
        actorEmail: null,
        action: 'chapter.ingest',
        targetKind: 'chapter',
        targetId: chapterId,
        before: null,
        // No bytes, no keys, no dimensions per page: the audit says WHAT
        // happened (how many pages, published or not), not the content.
        after: { pageCount: normalised.length, published },
      });
      return { pageCount: normalised.length, published };
    },
  };
}
