#!/usr/bin/env node
// @ts-check
/**
 * Wave 2 Yomi seed — deterministic 3-manga vertical.
 * Creates user reader.demo@example.test + 3 manga each ≥2 chapters × ≥5 pages,
 * with real page images via sharp + filesystem storage, published=true.
 * Reuses deterministicUuid from seed.mjs so reruns are no-ops.
 */

import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import * as argon2 from 'argon2';
import { loadEnv } from '../src/shared/validation/env.js';
import { createDb, closeDb } from '../src/server/db/client.js';
import { runMigrations } from '../src/server/db/migrations.js';
import * as schema from '../src/server/db/schema.js';
import { createFilesystemStorage } from '../src/server/storage/filesystem.js';
import { eq } from 'drizzle-orm';

const SEED_UUID_PREFIX = '594f4d49';
function deterministicUuid(kind, key) {
  const hash = createHash('sha256').update(`${kind}:${key}`).digest('hex');
  // v7-shaped: set version 7 and variant 8
  const raw = SEED_UUID_PREFIX + hash.slice(8, 32);
  const chars = raw.split('');
  chars[12] = '7';
  const v = parseInt(chars[19], 16);
  chars[19] = ((v & 0x3) | 0x8).toString(16);
  return `${chars.slice(0,8).join('')}-${chars.slice(8,12).join('')}-${chars.slice(12,16).join('')}-${chars.slice(16,20).join('')}-${chars.slice(20,32).join('')}`;
}

function assetKeyFor(slug, chapterNumber, pageNumber) {
  return createHash('sha256').update(`${slug}|${chapterNumber}|${pageNumber}`).digest('hex').slice(0, 32);
}

const MANGA_SPECS = [
  { title: 'Ame no Machi', slug: 'ame-no-machi', direction: 'rtl', synopsis: 'Rainy town stories.' },
  { title: 'Kuroi Hoshi', slug: 'kuroi-hoshi', direction: 'ltr', synopsis: 'Dark star chronicles.' },
  { title: 'Morning Circuit', slug: 'morning-circuit', direction: 'rtl', synopsis: 'Circuit mornings.' },
];

const CHAPTERS_PER_MANGA = 2;
const PAGES_PER_CHAPTER = 6;

async function renderPage({ title, chapterNumber, pageNumber, width = 480, height = 720 }) {
  const bg = pageNumber % 2 === 0 ? '#e6f0ff' : '#fff4e6';
  const accent = title === 'Ame no Machi' ? '#3b82f6' : title === 'Kuroi Hoshi' ? '#1f2937' : '#f59e0b';
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}"/>
      <rect x="20" y="20" width="${width-40}" height="${height-40}" fill="none" stroke="${accent}" stroke-width="4"/>
      <text x="${width/2}" y="${height/2 - 40}" font-family="sans-serif" font-size="28" font-weight="700" text-anchor="middle" fill="${accent}">${title}</text>
      <text x="${width/2}" y="${height/2}" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#374151">Chapter ${chapterNumber}</text>
      <text x="${width/2}" y="${height/2 + 40}" font-family="sans-serif" font-size="32" font-weight="800" text-anchor="middle" fill="#111827">Page ${pageNumber}</text>
      <text x="${width/2}" y="${height - 60}" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#6b7280">Yomi Wave2 • ${width}×${height}</text>
    </svg>`;
  const input = Buffer.from(svg);
  const avif = await sharp(input).avif({ quality: 50 }).toBuffer();
  const webp = await sharp(input).webp({ quality: 80 }).toBuffer();
  const jpeg = await sharp(input).jpeg({ quality: 80 }).toBuffer();
  return { avif, webp, jpeg, width, height };
}

async function main() {
  const env = loadEnv();
  console.log(`[seed-wave2] DATABASE_URL=${env.databaseUrl.slice(0, 30)}... storage=${process.env.STORAGE_DIR ?? 'storage'}`);

  // Ensure storage root exists
  const storageRoot = process.env.STORAGE_DIR ?? join(process.cwd(), 'storage');
  await mkdir(storageRoot, { recursive: true });

  // Run migrations (pglite or pg)
  try {
    const res = await runMigrations({ url: env.databaseUrl });
    console.log(`[seed-wave2] migrations applied: ${res.applied.length}, total journal: ${res.journal.length}`);
  } catch (e) {
    console.error('[seed-wave2] migration failed', e);
    // continue; pglite will create tables on first query if migrations failed due to already applied?
  }

  const db = await createDb(env);
  const storage = createFilesystemStorage();

  // 1. Ensure user reader.demo@example.test
  const userEmail = 'reader.demo@example.test';
  const userId = deterministicUuid('user', userEmail);
  const existingUser = await db.query.users.findFirst({ where: (f, { eq }) => eq(f.email, userEmail) });
  let targetUserId = existingUser?.id ?? userId;
  if (!existingUser) {
    const hash = await argon2.hash('demo-password-123', { type: argon2.argon2id });
    await db.insert(schema.users).values({
      id: userId,
      email: userEmail,
      displayName: 'Demo Reader',
      passwordHash: hash,
      role: 'reader',
      status: 'active',
    }).onConflictDoNothing();
    console.log(`[seed-wave2] user created ${userEmail} ${userId}`);
    targetUserId = userId;
  } else {
    console.log(`[seed-wave2] user exists ${userEmail} ${existingUser.id}`);
    targetUserId = existingUser.id;
  }

  // Also ensure genres/tags exist for FK
  const genreNames = ['Action', 'Drama'];
  const tagNames = ['demo', 'wave2'];
  for (const name of genreNames) {
    const id = deterministicUuid('genre', name);
    await db.insert(schema.genre).values({ id, name }).onConflictDoNothing();
  }
  for (const name of tagNames) {
    const id = deterministicUuid('tag', name);
    await db.insert(schema.tag).values({ id, name }).onConflictDoNothing();
  }
  const genreRows = await db.select().from(schema.genre);
  const tagRows = await db.select().from(schema.tag);
  const genreMap = new Map(genreRows.map(r => [r.name, r.id]));
  const tagMap = new Map(tagRows.map(r => [r.name, r.id]));

  // 2. Create manga + chapters + pages
  for (const spec of MANGA_SPECS) {
    const mangaId = deterministicUuid('manga', spec.slug);
    let existingManga = await db.query.manga.findFirst({ where: (f, { eq }) => eq(f.slug, spec.slug) });
    if (!existingManga) {
      const coverKey = assetKeyFor(spec.slug, 'cover', 1);
      await db.insert(schema.manga).values({
        id: mangaId,
        slug: spec.slug,
        title: spec.title,
        synopsis: spec.synopsis,
        status: 'ongoing',
        readingDirection: spec.direction,
        published: true,
        coverAssetKey: coverKey,
      }).onConflictDoNothing();
      // cover image
      const coverImg = await renderPage({ title: spec.title, chapterNumber: 'Cover', pageNumber: 1, width: 400, height: 600 });
      // store cover variants as pages/{mangaId}.ext? Actually layout is covers/{mangaId}.{ext}
      // For filesystem we store under covers/
      const coverBase = coverKey;
      for (const fmt of ['avif', 'webp', 'jpeg']) {
        const buf = fmt === 'avif' ? coverImg.avif : fmt === 'webp' ? coverImg.webp : coverImg.jpeg;
        const key = `covers/${mangaId}.${fmt}`;
        await storage.putStream(key, ReadableStreamFrom(buf), fmt === 'avif' ? 'image/avif' : fmt === 'webp' ? 'image/webp' : 'image/jpeg');
      }
      console.log(`[seed-wave2] manga created ${spec.title} ${mangaId}`);
      existingManga = { id: mangaId, slug: spec.slug };
    } else {
      console.log(`[seed-wave2] manga exists ${spec.title} ${existingManga.id}`);
    }
    const mid = existingManga.id;

    // link genre/tag (first of each)
    const gid = genreMap.get(genreNames[0]);
    const tid = tagMap.get(tagNames[0]);
    if (gid) await db.insert(schema.mangaGenre).values({ mangaId: mid, genreId: gid }).onConflictDoNothing();
    if (tid) await db.insert(schema.mangaTag).values({ mangaId: mid, tagId: tid }).onConflictDoNothing();

    for (let c = 1; c <= CHAPTERS_PER_MANGA; c++) {
      const chapterNumber = String(c);
      const chapterId = deterministicUuid('chapter', `${mid}#${chapterNumber}`);
      let existingChapter = await db.query.chapter.findFirst({ where: (f, { eq }) => eq(f.id, chapterId) });
      if (!existingChapter) {
        await db.insert(schema.chapter).values({
          id: chapterId,
          mangaId: mid,
          number: chapterNumber,
          title: `Chapter ${c}`,
          notes: '',
          status: 'published',
          publishedAt: new Date('2026-01-01T00:00:00Z'),
          pageCount: PAGES_PER_CHAPTER,
          readingOrder: c,
        }).onConflictDoNothing();
        console.log(`[seed-wave2] chapter created ${spec.slug} #${c} ${chapterId}`);
        existingChapter = { id: chapterId };
      }
      // Check pages exist
      const existingPages = await db.query.chapterPage.findMany({ where: (f, { eq }) => eq(f.chapterId, chapterId) });
      if (existingPages.length >= PAGES_PER_CHAPTER) {
        console.log(`[seed-wave2] pages exist for ${spec.slug} ch${c} (${existingPages.length})`);
        continue;
      }
      // Need to create pages that are missing
      const start = existingPages.length + 1;
      for (let p = start; p <= PAGES_PER_CHAPTER; p++) {
        const assetKey = assetKeyFor(spec.slug, chapterNumber, p);
        const existingPage = existingPages.find(x => x.pageNumber === p);
        if (existingPage) continue;
        const rendered = await renderPage({ title: spec.title, chapterNumber, pageNumber: p });
        // store variants
        for (const fmt of ['avif', 'webp', 'jpeg']) {
          const buf = fmt === 'avif' ? rendered.avif : fmt === 'webp' ? rendered.webp : rendered.jpeg;
          const s3Key = `pages/${chapterId}/${assetKey}.${fmt}`;
          await storage.putStream(s3Key, ReadableStreamFrom(buf), fmt === 'avif' ? 'image/avif' : fmt === 'webp' ? 'image/webp' : 'image/jpeg');
        }
        await db.insert(schema.chapterPage).values({
          chapterId,
          pageNumber: p,
          assetKey,
          width: rendered.width,
          height: rendered.height,
          byteSizeAvif: rendered.avif.length,
          byteSizeWebp: rendered.webp.length,
          byteSizeJpeg: rendered.jpeg.length,
        }).onConflictDoNothing();
        if (p === PAGES_PER_CHAPTER) console.log(`[seed-wave2] pages created for ${spec.slug} ch${c} ${PAGES_PER_CHAPTER} pages`);
      }
    }
  }

  // Verify
  const mangaCount = await db.select().from(schema.manga);
  console.log(`[seed-wave2] verify manga count=${mangaCount.length} titles=${mangaCount.map(m=>m.title).join(', ')}`);
  const chapterCount = await db.select().from(schema.chapter);
  console.log(`[seed-wave2] verify chapters=${chapterCount.length}`);
  const pageCount = await db.select().from(schema.chapterPage);
  console.log(`[seed-wave2] verify pages=${pageCount.length}`);

  await closeDb(db);
  console.log('[seed-wave2] done');
}

function ReadableStreamFrom(buf) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buf);
      controller.close();
    },
  });
}

main().catch(e => { console.error(e); process.exit(1); });
