import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateReaderWindow } from "../../src/features/reader/ports.ts";
import { displayIndex, stepPage, spreadFor, clamp } from "../../src/features/reader/reader-core.ts";

describe("T-READER-031 bounded window calculation", () => {
  test("calculates single page window correctly", () => {
    // single: -1 / +2
    const w = calculateReaderWindow({ currentPage: 5, totalPages: 20, mode: "single" });
    assert.deepEqual(w, { start: 4, end: 7 });
  });

  test("clamps window at start of chapter (first page)", () => {
    const w = calculateReaderWindow({ currentPage: 1, totalPages: 20, mode: "single" });
    assert.deepEqual(w, { start: 1, end: 3 });
  });

  test("clamps window at end of chapter (last page)", () => {
    const w = calculateReaderWindow({ currentPage: 20, totalPages: 20, mode: "single" });
    assert.deepEqual(w, { start: 19, end: 20 });
  });

  test("handles single-page chapter (M = 1)", () => {
    const w = calculateReaderWindow({ currentPage: 1, totalPages: 1, mode: "single" });
    assert.deepEqual(w, { start: 1, end: 1 });
  });

  test("enforces hard cap of 12 pages defensively", () => {
    const w = calculateReaderWindow({ currentPage: 10, totalPages: 500, mode: "vertical" });
    assert.ok(w.end - w.start + 1 <= 12);
  });
});

describe("T-READER-032 / reader-core page math & invariants", () => {
  const M = 240;

  test("displayIndex correctly maps RTL vs LTR and preserves sum invariant", () => {
    // In RTL, reading starts at M and goes down to 1
    assert.equal(displayIndex(240, M, "rtl"), 1);
    assert.equal(displayIndex(1, M, "rtl"), 240);
    assert.equal(displayIndex(229, M, "rtl"), 12);

    // In LTR, reading starts at 1
    assert.equal(displayIndex(1, M, "ltr"), 1);
    assert.equal(displayIndex(12, M, "ltr"), 12);

    // Sum invariant: rtl + ltr = M + 1 for every physical page
    for (let p = 1; p <= M; p++) {
      const rtlIdx = displayIndex(p, M, "rtl");
      const ltrIdx = displayIndex(p, M, "ltr");
      assert.equal(rtlIdx + ltrIdx, M + 1);
    }
  });

  test("stepPage advances along reading order without wrap-around", () => {
    // RTL step forward advances displayIndex by 1 (moves physical page -1)
    assert.equal(stepPage(229, 1, M, "rtl"), 228);
    assert.equal(stepPage(229, -1, M, "rtl"), 230);

    // Clamps at boundary (no wrap)
    assert.equal(stepPage(1, 1, M, "rtl"), 1); // at end of RTL reading
    assert.equal(stepPage(240, -1, M, "rtl"), 240); // at start of RTL reading

    // LTR step forward advances physical page +1
    assert.equal(stepPage(12, 1, M, "ltr"), 13);
    assert.equal(stepPage(12, -1, M, "ltr"), 11);
    assert.equal(stepPage(240, 1, M, "ltr"), 240); // at end of LTR reading
    assert.equal(stepPage(1, -1, M, "ltr"), 1); // at start of LTR reading
  });

  test("spreadFor pairs double-page spreads correctly", () => {
    // LTR pairing
    assert.deepEqual(spreadFor(1, M, "ltr"), [1, 2]);
    assert.deepEqual(spreadFor(2, M, "ltr"), [1, 2]);
    assert.deepEqual(spreadFor(3, M, "ltr"), [3, 4]);

    // RTL pairing: [right, left]
    assert.deepEqual(spreadFor(240, M, "rtl"), [240, 239]);
    assert.deepEqual(spreadFor(239, M, "rtl"), [240, 239]);
    assert.deepEqual(spreadFor(229, M, "rtl"), [230, 229]);

    // Odd-length chapter handling (final spread is single centered page)
    assert.deepEqual(spreadFor(19, 19, "ltr"), [19]);
    assert.deepEqual(spreadFor(1, 19, "rtl"), [1]);
    assert.deepEqual(spreadFor(1, 1, "rtl"), [1]);
  });
});
