import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { db } from "../../src/server/db/store.ts";

describe("API Contract and Persistence Integration Tests", () => {
  test("Catalog queries return only PUBLISHED manga", () => {
    const list = db.getPublishedMangaList();
    assert.ok(list.length > 0);
    assert.ok(list.every((m) => m.status === "PUBLISHED"));
  });

  test("Chapter manifest returns valid ordered pages and opaque asset keys", () => {
    const chapter = db.getChapter("ch-001");
    assert.ok(chapter);
    assert.equal(chapter.status, "PUBLISHED");

    const pages = db.getChapterPages("ch-001");
    assert.equal(pages.length, 12);
    // Page ordinals are 1-based and sequential
    pages.forEach((p, index) => {
      assert.equal(p.pageNumber, index + 1);
      // Asset key is opaque and never a raw server path
      assert.ok(p.assetKey.startsWith("asset://"));
      assert.ok(!p.assetKey.includes("/var/") && !p.assetKey.includes("/home/"));
    });
  });

  test("Reading progress is updated monotonically with incrementing version", () => {
    const userId = "usr-test-1";
    const chapterId = "ch-001";

    const p1 = db.saveProgress(userId, chapterId, 4);
    assert.equal(p1.pageNumber, 4);
    assert.equal(p1.version, 1);

    const p2 = db.saveProgress(userId, chapterId, 8);
    assert.equal(p2.pageNumber, 8);
    assert.equal(p2.version, 2);

    const fetched = db.getProgress(userId, chapterId);
    assert.ok(fetched);
    assert.equal(fetched.pageNumber, 8);
    assert.equal(fetched.version, 2);
  });

  test("Reader preferences save and retrieve accurately", () => {
    const userId = "usr-pref-test";
    db.savePreferences({
      userId,
      mode: "vertical",
      tapZonesEnabled: false,
      theme: "light",
      updatedAt: new Date().toISOString(),
    });

    const pref = db.getPreferences(userId);
    assert.equal(pref.mode, "vertical");
    assert.equal(pref.tapZonesEnabled, false);
    assert.equal(pref.theme, "light");
  });
});

import { prepareChapterUpload } from "../../src/features/uploads/contracts.ts";

describe("Upload Quarantine Policy (T-UPLOAD-014)", () => {
  test("Valid upload enters quarantined state", async () => {
    const res = await prepareChapterUpload({
      actorId: "usr-admin-1",
      chapterId: "ch-002",
      originalName: "chapter2.cbz",
      declaredBytes: 15 * 1024 * 1024,
      declaredMediaType: "application/x-cbz",
      idempotencyKey: "idem-001",
    });
    assert.equal(res.status, "quarantined");
    assert.ok(res.uploadId.startsWith("up-"));
  });

  test("Rejects unsupported media types", async () => {
    const res = await prepareChapterUpload({
      actorId: "usr-admin-1",
      chapterId: "ch-002",
      originalName: "malicious.exe",
      declaredBytes: 1024,
      declaredMediaType: "application/x-msdownload",
      idempotencyKey: "idem-002",
    });
    assert.equal(res.status, "rejected");
    assert.equal(res.rejectionCode, "UNSUPPORTED_MEDIA_TYPE");
  });

  test("Rejects payloads exceeding declared byte threshold", async () => {
    const res = await prepareChapterUpload({
      actorId: "usr-admin-1",
      chapterId: "ch-002",
      originalName: "oversized.zip",
      declaredBytes: 300 * 1024 * 1024, // 300MB
      declaredMediaType: "application/zip",
      idempotencyKey: "idem-003",
    });
    assert.equal(res.status, "rejected");
    assert.equal(res.rejectionCode, "BYTE_LIMIT_EXCEEDED");
  });
});
