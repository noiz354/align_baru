#!/usr/bin/env node
/**
 * check-claims — verify falsifiable environment claims against the filesystem.
 *
 * Why this exists
 * ---------------
 * A comment that states an environment fact outlives the run that justified it. Two
 * files in this repo carried the claim "`@axe-core/playwright` is NOT installed in this
 * repository" while the dependency sat in `package.json` and a sibling spec imported and
 * ran it. The claim was true when written and was never revisited, and it actively sent a
 * reader away from the real work.
 *
 * What it does
 * ------------
 * Finds claims about whether a package is present, then checks each one against ground
 * truth: the package.json files in this repo, and the source tree for actual imports.
 * A claim of absence that is contradicted by either is a failure.
 *
 * It is deliberately narrow. It verifies the one class of claim that can be settled by
 * looking at the tree, and it says so when it cannot settle something. It does not try to
 * judge prose.
 *
 * Usage
 * -----
 *   node scripts/check-claims.mjs           # human-readable table, exit 1 on contradiction
 *   node scripts/check-claims.mjs --json    # machine-readable
 *   node scripts/check-claims.mjs --verbose # list clean claims too
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname;

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.py', '.md']);

// Directories that are regenerated, vendored, or that describe the checker itself. A
// checker that flags its own documentation is a checker people disable.
const SKIP_DIRECTORIES = new Set([
  'node_modules', '.next', 'dist', 'build', 'coverage', '.git', '__pycache__',
  '.venv', 'venv', '.turbo', 'out', 'runs',
]);

const SKIP_PATH_PREFIXES = [
  '.opencode/skills',      // the skill pack documents these claim patterns on purpose
  'scripts/check-claims.mjs',
];

// Claims that a package is ABSENT. The token may be backticked or bare — real comments
// write "`@axe-core/playwright` is not installed" and "@axe-core/playwright is NOT
// installed" interchangeably, and requiring backticks silently missed the second form
// the first time this script ran. The token is captured from either shape.
const ABSENCE_VERBS = String.raw`(?:NOT\s+|not\s+)(?:installed|present|available|added|wired|configured|declared|listed|registered|set\s+up)`;
const TOKEN = String.raw`@?[A-Za-z0-9][A-Za-z0-9@/._-]*`;

const CLAIM_PATTERNS = [
  // "@scope/pkg is NOT installed" / "pkg is not present" / "pkg has not been wired"
  { id: 'absent', regex: new RegExp(String.raw`\`?(${TOKEN})\`?\s+(?:is|are|has|have)\s+${ABSENCE_VERBS}`, 'g') },
  // "X is not installed in this repository" / "in this repo"
  { id: 'absent', regex: new RegExp(String.raw`\`?(${TOKEN})\`?\s+${ABSENCE_VERBS}\s+in\s+this\s+repo`, 'g') },
  // "NOT installed: @scope/pkg" / "not installed — pkg"
  { id: 'absent', regex: new RegExp(String.raw`${ABSENCE_VERBS}\s*[:—,-]?\s+\`?(${TOKEN})\`?`, 'g') },
  // "no @scope/pkg dependency" / "no `pkg` row"
  { id: 'absent', regex: new RegExp(String.raw`no\s+\`?(${TOKEN})\`?\s+(?:dependency|dependencies|row|entry|package|support)`, 'g') },
];

// A bare identifier is a plausible package name; a relative path fragment is not. This
// keeps "not wired" style comments from resolving to a file.
function looksLikePackage(token) {
  if (!token || token.length < 2) return false;
  if (token.includes('/') && !token.startsWith('@')) return false; // bare path fragment
  if (/\.(md|json|mjs|ts|tsx|js|py|sql|yml|yaml)$/.test(token)) return false; // a file
  if (token.endsWith('/')) return false;
  return /[@\-.]/.test(token) || /^[a-z][a-z0-9]*$/.test(token);
}

function isScannablePath(absolutePath) {
  const rel = relative(REPO_ROOT, absolutePath);
  if (SKIP_PATH_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
    return false;
  }
  return !rel.split('/').some((segment) => SKIP_DIRECTORIES.has(segment));
}

function walkFiles(absoluteDir, out = []) {
  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    const full = join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walkFiles(full, out);
    } else if (SCAN_EXTENSIONS.has(extname(entry.name))) {
      if (isScannablePath(full)) out.push(full);
    }
  }
  return out;
}

/** Every dependency declared across every package.json in the repo. */
function collectDeclaredPackages() {
  const declared = new Map(); // package name -> [manifest paths]
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) continue;
        walk(full);
      } else if (entry.name === 'package.json') {
        try {
          const manifest = JSON.parse(readFileSync(full, 'utf8'));
          for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
            for (const name of Object.keys(manifest[field] ?? {})) {
              if (!declared.has(name)) declared.set(name, []);
              declared.get(name).push(relative(REPO_ROOT, full));
            }
          }
        } catch {
          // An unparseable manifest is not this check's problem.
        }
      }
    }
  };
  walk(REPO_ROOT);
  return declared;
}

/** Package name -> set of source files that import it, so a reader can audit the claim. */
function collectImportSites() {
  const sites = new Map();
  for (const file of walkFiles(REPO_ROOT)) {
    if (extname(file) === '.md') continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      const name = specifier.startsWith('@') || !specifier.includes('/')
        ? specifier
        : specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
      if (!sites.has(name)) sites.set(name, new Set());
      sites.get(name).add(relative(REPO_ROOT, file));
    }
  }
  return sites;
}

const CLAIM_LINE_LIMIT = 400; // a "claim" longer than this is prose, not a claim

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1;
  return line;
}

function excerptAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? undefined : end).trim();
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const verbose = args.has('--verbose');

  const declared = collectDeclaredPackages();
  const importSites = collectImportSites();

  const findings = [];
  let scannedFiles = 0;

  for (const file of walkFiles(REPO_ROOT)) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scannedFiles += 1;
    if (text.length > 2_000_000) continue;

    for (const { id, regex } of CLAIM_PATTERNS) {
      // Fresh lastIndex per pattern: the same claim can match two patterns.
      for (const match of text.matchAll(new RegExp(regex.source, regex.flags))) {
        const packageName = match[1];
        if (!looksLikePackage(packageName)) continue;
        const excerpt = excerptAt(text, match.index);
        if (excerpt.length > CLAIM_LINE_LIMIT) continue;

        const isDeclared = declared.has(packageName);
        const importers = [...(importSites.get(packageName) ?? [])];
        const isImported = importers.length > 0;

        // Only a claim this tool can actually settle gets a verdict. If the repo
        // declares or imports the package, an absence claim is flatly false. If the
        // repo says nothing about it, the absence may still be true — this tool has
        // no registry access and will not guess, so it reports and defers to a human
        // instead of passing the claim as verified.
        const verdict = isDeclared || isImported ? 'CONTRADICTED' : 'UNVERIFIABLE';

        findings.push({
          kind: id,
          file: relative(REPO_ROOT, file),
          line: lineOf(text, match.index),
          package: packageName,
          excerpt,
          isDeclared,
          declaredIn: declared.get(packageName) ?? [],
          isImported,
          importedBy: importers.slice(0, 4),
          verdict,
        });
      }
    }
  }

  const contradicted = findings.filter((f) => f.verdict === 'CONTRADICTED');
  // An unverifiable claim is only worth a human's attention if the token carries a
  // package signal (@ scope, dash, or slash). Plain words that the pattern swept up
  // while reading prose ("no stale rule", "so you", "dev") are filtered here, because
  // a tool that cries wolf on 90 lines of English gets ignored on the 2 that matter.
  const unverifiable = findings.filter(
    (f) => f.verdict === 'UNVERIFIABLE' && /[@/-]/.test(f.package),
  );

  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        { scannedFiles, contradicted: contradicted.length, unverifiable: unverifiable.length, findings },
        null,
        2,
      )}\n`,
    );
    process.exit(contradicted.length > 0 ? 1 : 0);
  }

  console.log('check-claims — falsifiable environment claims vs ground truth');
  console.log(`scanned ${scannedFiles} files, ${declared.size} declared packages\n`);

  if (findings.length === 0) {
    console.log('no package-presence claims found');
  }

  if (contradicted.length) {
    console.log(`CONTRADICTED (${contradicted.length}) — the claim says absent, the tree says present:`);
    for (const f of contradicted) {
      console.log(`\n  ${f.file}:${f.line}  claims "${f.package}" is absent`);
      console.log(`    in comment: ${f.excerpt.slice(0, 160)}`);
      if (f.isDeclared) console.log(`    reality: declared in ${f.declaredIn.join(', ')}`);
      if (f.isImported) console.log(`    reality: imported by ${f.importedBy.join(', ')}`);
    }
    console.log('');
  }

  if (unverifiable.length) {
    const shown = verbose ? unverifiable : unverifiable.slice(0, 8);
    console.log(`UNVERIFIABLE (${unverifiable.length}) — an absence claim about a package this repo never mentions:`);
    for (const f of shown) console.log(`  ${f.file}:${f.line}  "${f.package}"`);
    if (!verbose && unverifiable.length > shown.length) {
      console.log(`  … ${unverifiable.length - shown.length} more (pass --verbose)`);
    }
    console.log('  This tool has no registry access, so it cannot confirm these. Read them.');
    console.log('');
  }

  if (contradicted.length === 0) {
    console.log('OK — no contradicted package-presence claim');
  } else {
    console.log(
      `${contradicted.length} contradicted claim(s). An absent-package claim that the\n` +
        'tree contradicts is worse than no comment: it redirects a reader. Fix the\n' +
        'comment, or add the package, and make the comment say which one it is.',
    );
  }
  process.exit(contradicted.length > 0 ? 1 : 0);
}

main();
