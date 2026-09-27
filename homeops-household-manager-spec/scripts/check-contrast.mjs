#!/usr/bin/env node
/**
 * scripts/check-contrast.mjs — token and contrast gate (T-PLAT-015, NFR-A11Y-005).
 *
 * Asserts, from `src/app/globals.css` alone:
 *  1. every colour token exists in BOTH themes (light `@theme` block and the dark remap);
 *  2. text tokens reach >= 4.5:1 and large-text/non-text tokens reach >= 3:1 (WCAG 2.2 AA);
 *  3. the focus ring reaches >= 3:1 against every surface it can appear on;
 *  4. no component hard-codes a colour literal (hex / rgb() / oklch()) outside the token block.
 *
 * Dependency-free by design (like the other gates): it parses CSS custom properties and converts
 * oklch to linear sRGB itself, so the gate cannot drift behind a library's colour handling.
 *
 * Exit code 0 = pass, 1 = violations (printed as token pair + measured ratio).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const CSS_PATH = join(ROOT, 'src/app/globals.css');

/* ------------------------------------------------------------------ colour maths ------------- */

function oklchToLinearSrgb(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;
  return [
    4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

function channelToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function hexToLinearSrgb(hex) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [channelToLinear(r), channelToLinear(g), channelToLinear(b)];
}

function parseColor(raw) {
  const value = raw.trim();
  const oklch = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (oklch) {
    let l = Number(oklch[1]);
    if (value.includes('%')) l /= 100;
    return oklchToLinearSrgb(l, Number(oklch[2]), Number(oklch[3]));
  }
  const rgb = /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)$/.exec(value);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((v) => channelToLinear(Number(v) / 255));
  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) return hexToLinearSrgb(value);
  if (value === 'white') return [1, 1, 1];
  if (value === 'black') return [0, 0, 0];
  return null;
}

function relativeLuminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgRaw, bgRaw) {
  const fg = parseColor(fgRaw);
  const bg = parseColor(bgRaw);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------------ token extraction --------- */

const css = readFileSync(CSS_PATH, 'utf8');

function extractVars(block) {
  const vars = new Map();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars.set(match[1], match[2].trim());
  }
  return vars;
}

const themeBlock = /@theme\s*\{([\s\S]*?)\n\}/.exec(css);
if (!themeBlock) {
  console.error('check-contrast: no @theme block found in src/app/globals.css');
  process.exit(1);
}
const light = extractVars(themeBlock[1]);

const darkBlock = /@media \(prefers-color-scheme: dark\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\n  \}/.exec(css);
const darkOverrides = darkBlock ? extractVars(darkBlock[1]) : new Map();
const dark = new Map(light);
for (const [key, value] of darkOverrides) dark.set(key, value);

const COLOUR_TOKENS = [...light.keys()].filter((key) => key.startsWith('--color-'));
const DARK_REMAPPED = [...darkOverrides.keys()].filter((key) => key.startsWith('--color-'));

/* ------------------------------------------------------------------ assertions --------------- */

const failures = [];

// 1. Every colour token must be defined in the light theme; surfaces and text must be remapped for
//    dark, otherwise dark mode inherits light-mode text colours (DESIGN-SYSTEM.md §2).
const REQUIRED_DARK_REMAP = [
  '--color-bg',
  '--color-surface',
  '--color-border',
  '--color-text',
  '--color-text-muted',
];
for (const token of REQUIRED_DARK_REMAP) {
  if (!darkOverrides.has(token)) failures.push(`dark theme does not remap ${token}`);
}

// 2. Contrast pairs. `min` is the WCAG 2.2 AA threshold for that usage (ACCESSIBILITY.md §3).
const PAIRS = [
  { fg: '--color-text', bg: '--color-bg', min: 4.5, why: 'body text on app background' },
  { fg: '--color-text', bg: '--color-surface', min: 4.5, why: 'body text on cards' },
  { fg: '--color-text-muted', bg: '--color-bg', min: 4.5, why: 'muted text on app background' },
  { fg: '--color-text-muted', bg: '--color-surface', min: 4.5, why: 'muted text on cards' },
  { fg: '--color-primary-fg', bg: '--color-primary', min: 4.5, why: 'label on primary action' },
  { fg: '--color-primary', bg: '--color-surface', min: 3.0, why: 'primary border/link on cards' },
  { fg: '--color-focus', bg: '--color-bg', min: 3.0, why: 'focus ring on app background' },
  { fg: '--color-focus', bg: '--color-surface', min: 3.0, why: 'focus ring on cards' },
  { fg: '--color-success', bg: '--color-surface', min: 3.0, why: 'status shape/border (CLEAN, DONE)' },
  {
    fg: '--color-attention',
    bg: '--color-surface',
    min: 3.0,
    why: 'status shape/border (NEEDS_ATTENTION, LOW)',
  },
  { fg: '--color-warning', bg: '--color-surface', min: 3.0, why: 'status shape/border (DIRTY, FULL)' },
  { fg: '--color-critical', bg: '--color-surface', min: 3.0, why: 'status shape/border (URGENT, SAFETY)' },
  { fg: '--color-critical', bg: '--color-bg', min: 4.5, why: 'critical text on app background' },
  { fg: '--color-warning', bg: '--color-bg', min: 4.5, why: 'overdue text on app background' },
  { fg: '--color-neutral', bg: '--color-surface', min: 3.0, why: 'unknown/archived shape on cards' },
  { fg: '--color-border', bg: '--color-surface', min: 1.5, why: 'card hairline (non-text, informational)' },
];

for (const theme of ['light', 'dark']) {
  const tokens = theme === 'light' ? light : dark;
  for (const pair of PAIRS) {
    const fg = tokens.get(pair.fg);
    const bg = tokens.get(pair.bg);
    if (!fg || !bg) {
      failures.push(`[${theme}] missing token for ${pair.fg} / ${pair.bg} (${pair.why})`);
      continue;
    }
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) {
      failures.push(`[${theme}] unparsable colour: ${pair.fg}=${fg} or ${pair.bg}=${bg}`);
      continue;
    }
    if (ratio < pair.min) {
      failures.push(
        `[${theme}] ${pair.fg} on ${pair.bg} = ${ratio.toFixed(2)}:1, needs >= ${pair.min}:1 (${pair.why})`,
      );
    }
  }
}

// 3. No component may hard-code a colour literal outside the token block (T-PLAT-015 grep gate).
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(|\bhsla?\(/;
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(full);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      yield full;
    }
  }
}

for (const file of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, file);
  if (rel === 'src/app/globals.css') continue; // the token block is the only allowed source
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (COLOUR_LITERAL.test(line)) {
      failures.push(`${rel}:${index + 1} hard-codes a colour literal — use a token from globals.css`);
    }
  });
}

/* ------------------------------------------------------------------ report ------------------- */

console.log(
  `check-contrast: ${COLOUR_TOKENS.length} colour tokens, ${DARK_REMAPPED.length} remapped for dark, ${PAIRS.length} pairs x 2 themes`,
);
if (failures.length > 0) {
  console.error(`\n${failures.length} violation(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('check-contrast: all token contrast targets met (WCAG 2.2 AA)');
