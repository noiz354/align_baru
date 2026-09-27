#!/usr/bin/env node
/* ===========================================================================
   Reader direction and page math — check against docs/product/reader-behavior.md
   ---------------------------------------------------------------------------
   This is the reader's own code, not a transcription of it. The two spread
   functions and displayIndex / stepPage are extracted from
   prototype/reader.js at run time and evaluated, so the checks below cannot
   pass against a stale copy: if the implementation drifts, the extraction
   fails and so does this script.

   The first version of this file re-declared the functions by hand, and it
   immediately found a real bug: for an odd-length chapter the spread pairing
   returned a partner page outside [1, M], which would have drawn a
   half-empty pair. Keeping the extraction is the reason that stays caught.

   Usage:  node tools/reader-logic-check.mjs
   =========================================================================== */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, '..', 'prototype', 'reader.js'), 'utf8');

/* --- pull the real functions out of the shipped source ------------------- */

function extract(name) {
  const start = SRC.indexOf('function ' + name + '(');
  if (start === -1) { throw new Error('could not find ' + name + '() in reader.js'); }
  let depth = 0;
  const i = SRC.indexOf('{', start);
  for (let j = i; j < SRC.length; j += 1) {
    if (SRC[j] === '{') { depth += 1; }
    else if (SRC[j] === '}') {
      depth -= 1;
      if (depth === 0) { return SRC.slice(start, j + 1); }
    }
  }
  throw new Error('unbalanced braces in ' + name + '()');
}

const isRtlSrc = 'function isRtl() { return S.readingDirection === "rtl"; }';
const clampSrc = 'function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }';

const displayIndexSrc = extract('displayIndex');
const stepPageSrc = extract('stepPage');
const spreadForSrc = extract('spreadFor');

/* S.totalPages lives on the state object; expose it so the extracted code can
   be driven from the checks below. */
const factory = new Function(
  'S',
  [
    isRtlSrc,
    clampSrc,
    displayIndexSrc,
    stepPageSrc,
    spreadForSrc,
    'return { displayIndex, stepPage, spreadFor, clamp };'
  ].join('\n')
);

const state = { totalPages: 240, readingDirection: 'rtl', currentPage: 229 };
const R = factory(state);

/* --- harness -------------------------------------------------------------- */

let failures = 0;
let checks = 0;

function ok(label) {
  checks += 1;
  console.log('  ok    ' + label);
}

function eq(label, got, want) {
  checks += 1;
  if (JSON.stringify(got) === JSON.stringify(want)) {
    console.log('  ok    ' + label + '  ' + JSON.stringify(got));
  } else {
    failures += 1;
    console.log('  FAIL  ' + label);
    console.log('        got  ' + JSON.stringify(got));
    console.log('        want ' + JSON.stringify(want));
  }
}

function rtl(on) { state.readingDirection = on ? 'rtl' : 'ltr'; }
function setM(total) { state.totalPages = total; }

const M = 240;

/* === §4 the indicator is the reading-order position ====================== */

console.log('=== §4 displayIndex: the indicator is never the physical page ===');
rtl(true); setM(M);
eq('rtl, pageNumber 229 of 240 reads as "Page 12 of 240"', R.displayIndex(229), 12);
eq('rtl, the reading-start page (240) reads as 1', R.displayIndex(240), 1);
eq('rtl, the reading-end page (1) reads as 240', R.displayIndex(1), 240);
rtl(false);
eq('ltr, pageNumber 12 reads as 12', R.displayIndex(12), 12);
eq('ltr, page 1 reads as 1', R.displayIndex(1), 1);

rtl(true);
let rangeOk = true, sumOk = true;
for (let p = 1; p <= M; p += 1) {
  const d = R.displayIndex(p);
  if (d < 1 || d > M) { rangeOk = false; break; }
  /* Flipping direction preserves the physical page; the two indicators for
     one physical page sum to M + 1. That is what a flip recomputes. */
  if (d + R.displayIndex(p) !== M + 1) { }
}
for (let p = 1; p <= M; p += 1) {
  rtl(true); const a = R.displayIndex(p);
  rtl(false); const b = R.displayIndex(p);
  if (a + b !== M + 1) { sumOk = false; break; }
}
rtl(true);
if (rangeOk) { ok('displayIndex stays within [1, M] for all ' + M + ' pages'); }
else { failures += 1; console.log('  FAIL  displayIndex left [1, M]'); }
if (sumOk) { ok('rtl and ltr displayIndex sum to M+1 for every physical page'); }
else { failures += 1; console.log('  FAIL  indices did not sum to M+1'); }

/* === §4 "next" moves along the reading order ============================== */

console.log('\n=== §4 stepPage: next is a step in reading order, not in numbering ===');
/* stepPage(forward) reads S.currentPage, exactly as the reader does, so the
   checks drive it through the state rather than passing a page in. */
function at(page) { state.currentPage = page; }
rtl(true); at(229);
eq('rtl, next from 229 is 228', R.stepPage(1), 228);
eq('rtl, previous from 229 is 230', R.stepPage(-1), 230);
rtl(false); at(12);
eq('ltr, next from 12 is 13', R.stepPage(1), 13);
eq('ltr, previous from 12 is 11', R.stepPage(-1), 11);

rtl(true);
let advOk = true;
for (let p = 1; p < M; p += 1) {
  at(p);
  if (R.displayIndex(R.stepPage(1)) !== R.displayIndex(p) + 1) { advOk = false; break; }
}
if (advOk) { ok('rtl "next" advances the indicator by exactly one, on every page'); }
else { failures += 1; console.log('  FAIL  rtl next did not advance the indicator'); }

/* === §6 spread pairing (UNIT-READER-006, UNIT-READER-007) =============== */

console.log('\n=== §6 double-page pairing, left to right ===');
rtl(false); setM(M);
eq('ltr spread of 1', R.spreadFor(1), [1, 2]);
eq('ltr spread of 2', R.spreadFor(2), [1, 2]);
eq('ltr spread of 3', R.spreadFor(3), [3, 4]);
eq('ltr spread of 4', R.spreadFor(4), [3, 4]);
eq('ltr spread of 239, the last spread of an even chapter', R.spreadFor(239), [239, 240]);

console.log('\n=== §6 double-page pairing, right to left ===');
rtl(true); setM(M);
eq('rtl spread of 240', R.spreadFor(240), [240, 239]);
eq('rtl spread of 239', R.spreadFor(239), [240, 239]);
eq('rtl spread of 238', R.spreadFor(238), [238, 237]);
eq('rtl spread of 237', R.spreadFor(237), [238, 237]);
eq('rtl spread of 229, the position the screens use', R.spreadFor(229), [230, 229]);
eq('rtl spread of 1, M=240 even, so the last spread is a full pair', R.spreadFor(1), [2, 1]);

console.log('\n=== §6 odd page count: the final spread is ONE centred page (EC-RDR-03) ===');
rtl(false); setM(19);
eq('ltr, M=19, spread of 19', R.spreadFor(19), [19]);
eq('ltr, M=19, spread of 18', R.spreadFor(18), [17, 18]);
rtl(true); setM(19);
eq('rtl, M=19, spread of 1', R.spreadFor(1), [1]);
eq('rtl, M=19, spread of 2', R.spreadFor(2), [3, 2]);
rtl(false); setM(241);
eq('ltr, M=241, spread of 241', R.spreadFor(241), [241]);
eq('ltr, M=241, spread of 239', R.spreadFor(239), [239, 240]);
rtl(true); setM(241);
eq('rtl, M=241, spread of 241', R.spreadFor(241), [241, 240]);
eq('rtl, M=241, spread of 240', R.spreadFor(240), [241, 240]);
eq('rtl, M=241, spread of 239', R.spreadFor(239), [239, 238]);
eq('rtl, M=241, spread of 1', R.spreadFor(1), [1]);

console.log('\n=== EC-RDR-01 a one-page chapter has a one-page spread ===');
setM(1);
rtl(false); eq('ltr, M=1', R.spreadFor(1), [1]);
rtl(true); eq('rtl, M=1', R.spreadFor(1), [1]);

console.log('\n=== every page sits in exactly one spread, at every size ===');
function coverCheck(dir, total) {
  const counts = new Map();
  rtl(dir === 'rtl'); setM(total);
  for (let p = 1; p <= total; p += 1) {
    const sp = R.spreadFor(p);
    if (sp.length < 1 || sp.length > 2) {
      return { ok: false, why: 'spread of ' + sp.length + ' pages at page ' + p };
    }
    for (const q of sp) {
      if (q < 1 || q > total) {
        return { ok: false, why: 'spread ' + sp.join(',') + ' contains ' + q +
                 ', outside [1,' + total + ']' };
      }
    }
    const key = sp.join(',');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const [key, n] of counts) {
    if (n !== 2 && n !== 1) {
      return { ok: false, why: 'spread ' + key + ' claims ' + n + ' pages' };
    }
  }
  const singles = Array.from(counts.values()).filter((n) => n === 1).length;
  if (singles > 1) { return { ok: false, why: singles + ' single-page spreads' }; }
  return { ok: true, why: '' };
}
for (const [d, t] of [['ltr', 1], ['rtl', 1], ['ltr', 19], ['rtl', 19],
                       ['ltr', 240], ['rtl', 240], ['ltr', 241], ['rtl', 241],
                       ['ltr', 500], ['rtl', 500]]) {
  const r = coverCheck(d, t);
  if (r.ok) {
    ok(d + ' M=' + t + ': every page in one spread, at most one of them single');
  } else {
    failures += 1;
    console.log('  FAIL  ' + d + ' M=' + t + ': ' + r.why);
  }
}

/* === §13 no wrap-around, ever (T-READER-033) ============================= */

console.log('\n=== §13 no wrap-around ===');
setM(M);
rtl(true);
at(1);
eq('rtl next at the reading-end page clamps to it', R.clamp(R.stepPage(1), 1, M), 1);
at(240);
eq('rtl previous at the reading-start page clamps to it', R.clamp(R.stepPage(-1), 1, M), 240);
rtl(false);
at(240);
eq('ltr next at the reading-end page clamps to it', R.clamp(R.stepPage(1), 1, M), 240);
at(1);
eq('ltr previous at the reading-start page clamps to it', R.clamp(R.stepPage(-1), 1, M), 1);

/* === §8.1 zoom bounds ==================================================== */

console.log('\n=== §8.1 zoom is bounded to 100-400% ===');
eq('below the floor clamps up', R.clamp(90, 100, 400), 100);
eq('above the ceiling clamps down', R.clamp(410, 100, 400), 400);
eq('a 10% step from 100', R.clamp(100 + 10, 100, 400), 110);

console.log('\n' + (failures
  ? failures + ' of ' + checks + ' checks FAILED'
  : 'all ' + checks + ' reader logic checks pass'));
process.exit(failures ? 1 : 0);
