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
 * Two classes of falsifiable claim, both settled by looking at the tree:
 *
 * 1. Package presence. Finds claims about whether a package is present, then
 *    checks each one against ground truth: the package.json files in this repo,
 *    and the source tree for actual imports. A claim of absence that is
 *    contradicted by either is a failure.
 *
 * 2. File landmark claims. A doc comment that marks a file `✅ landed` asserts
 *    the file exists; a `PLANNED_*` array that names a port asserts its file
 *    does not. Both directions are checked, because the failure mode is drift
 *    in either direction — an inventory that marks a file it does not have, or
 *    lists a port as pending after the implementation landed.
 *
 * It is deliberately narrow. It verifies the classes of claim that can be settled
 * by looking at the tree, and it says so when it cannot settle something. It
 * does not try to judge prose.
 *
 * Usage
 * -----
 *   node scripts/check-claims.mjs           # human-readable table, exit 1 on contradiction
 *   node scripts/check-claims.mjs --json    # machine-readable
 *   node scripts/check-claims.mjs --verbose # list clean claims too
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';

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

/* ── class 2: file landmark claims ─────────────────────────────────────────── */

// A doc-comment line that names a file and marks it landed. The `✅ landed`
// marker is the assertion; the filename beside it is the subject. Em-dash and
// hyphen are both accepted because the file this checks was written with each.
const LANDED_CLAIM =
  /^[ \t]*(?:\/\/|\*|#)[ \t]*`?([A-Za-z0-9][A-Za-z0-9._-]*\.[a-z]+)`?[ \t]+[—-][^\n]*\u2705[ \t]*landed/gm;

// `export const PLANNED_REPOSITORIES = ['a', 'b'] as const;` — the names are
// asserted NOT to have files. Checked because a pending list that keeps an
// already-landed port is the same drift as the inverse.
const PLANNED_LIST = /(?:export\s+)?const\s+PLANNED_[A-Z0-9_]+\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]/g;

function collectFileLandmarkClaims(dirname) {
  const claims = [];

  for (const file of walkFiles(REPO_ROOT)) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const baseDir = dirname(file);

    for (const match of text.matchAll(LANDED_CLAIM)) {
      const name = match[1];
      const target = join(baseDir, name);
      claims.push({
        kind: 'landed-file',
        file: relative(REPO_ROOT, file),
        line: lineOf(text, match.index),
        subject: name,
        // Resolved against the CLAIMING file's directory, not the repo root:
        // these inventories are written as sibling lists, so that is the only
        // reading that makes a name resolve to something real.
        resolvesTo: relative(REPO_ROOT, target),
        excerpt: excerptAt(text, match.index),
        verdict: existsSync(target) ? 'CONSISTENT' : 'CONTRADICTED',
      });
    }

    for (const match of text.matchAll(PLANNED_LIST)) {
      for (const quoted of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
        const port = quoted[1];
        const target = join(baseDir, `${port}.repository.ts`);
        claims.push({
          kind: 'planned-file',
          file: relative(REPO_ROOT, file),
          line: lineOf(text, match.index),
          subject: port,
          resolvesTo: relative(REPO_ROOT, target),
          excerpt: excerptAt(text, match.index),
          // Listed as pending but present on disk: the inventory is stale.
          verdict: existsSync(target) ? 'CONTRADICTED' : 'CONSISTENT',
        });
      }
    }
  }

  return claims;
}

const CLAIM_LINE_LIMIT = 400; // a "claim" longer than this is prose, not a claim

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === '\n') line += 1;
  return line;
}

// `export const PLANNED_STUB_PORTS = [{ file, task }] as const;` — the assertion is
// the INVERSE of a planned file: the file is expected to exist AND still to contain
// `Not implemented: T-…` for that task.
//
// A file-existence check is the wrong instrument for most of this codebase's gaps.
// A port that has no implementation usually still HAS a file: `search.repository.ts`
// declares the interface, `admin.service.ts` declares the service, and the factory
// inside throws. Checking "does the file exist" would report those as done, which is
// precisely the false completion the `WIRED` bucket was deleted for. So this class
// asserts the stub itself: the throw is the evidence, and the inventory fails when
// the throw disappears without the inventory being updated. That is the same drift
// guard as `PLANNED_LIST`, pointed the other way.
const STUB_LIST =
  /(?:export\s+)?const\s+PLANNED_STUB_PORTS\s*(?::[^=]+)?=\s*\[([\s\S]*?)\]\s*as\s+const/g;
const STUB_ENTRY = /\{\s*file\s*:\s*['"]([^'"]+)['"]\s*,\s*task\s*:\s*['"](T-[A-Z0-9]+-\d+)['"]\s*\}/g;
const NOT_IMPLEMENTED = /Not implemented:\s*(T-[A-Z0-9]+-\d+)/;

function collectStubClaims() {
  const claims = [];

  for (const file of walkFiles(REPO_ROOT)) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const list of text.matchAll(STUB_LIST)) {
      for (const entry of list[1].matchAll(STUB_ENTRY)) {
        const [, relPath, task] = entry;
        // Resolved against the CLAIMING file's directory, like the two classes
        // above — this repository is a monorepo, so a "repo root" is ambiguous and
        // a path that silently meant the wrong root is exactly the kind of
        // false-green this tool exists to prevent.
        const target = join(dirname(file), relPath);
        let verdict;
        let detail;
        if (!existsSync(target)) {
          verdict = 'CONTRADICTED';
          detail = 'the file named as a stub does not exist';
        } else {
          let body = '';
          try {
            body = readFileSync(target, 'utf8');
          } catch {
            body = '';
          }
          if (NOT_IMPLEMENTED.test(body)) {
            // Present and still throwing — but only a verdict if it is throwing for
            // THIS task. A file that throws a different id is drift, not agreement.
            verdict = body.includes(`Not implemented: ${task}`) ? 'CONSISTENT' : 'CONTRADICTED';
            detail = verdict === 'CONTRADICTED' ? 'it no longer throws the task it is listed under' : '';
          } else {
            verdict = 'CONTRADICTED';
            detail = 'it no longer throws — the port is implemented but still listed as pending';
          }
        }
        claims.push({
          kind: 'stub-port',
          file: relative(REPO_ROOT, file),
          line: lineOf(text, list.index),
          subject: `${relPath} (${task})`,
          resolvesTo: relPath,
          excerpt: excerptAt(text, list.index),
          detail,
          verdict,
        });
      }
    }
  }

  return claims;
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
  const fileClaims = [...collectFileLandmarkClaims(dirname), ...collectStubClaims()];

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
  const fileContradicted = fileClaims.filter((f) => f.verdict === 'CONTRADICTED');
  const fileConsistent = fileClaims.filter((f) => f.verdict === 'CONSISTENT');
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
        {
          scannedFiles,
          contradicted: contradicted.length,
          unverifiable: unverifiable.length,
          findings,
          fileClaimsContradicted: fileContradicted.length,
          fileClaimsChecked: fileClaims.length,
          fileClaims: fileClaims.filter((f) => f.verdict === 'CONTRADICTED' || verbose),
        },
        null,
        2,
      )}\n`,
    );
    process.exit(contradicted.length + fileContradicted.length > 0 ? 1 : 0);
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

  // ── class 2: file landmark claims ──
  const reportFileClaims = () => {
    console.log(
      `FILE LANDMARKS (${fileClaims.length}) — ${fileConsistent.length} consistent, ` +
        `${fileContradicted.length} contradicted:`,
    );
    const shown = verbose ? fileClaims : [...fileContradicted, ...fileConsistent].slice(0, 12);
    for (const f of shown) {
      const mark = f.verdict === 'CONTRADICTED' ? 'CONTRADICTED' : 'ok          ';
      console.log(`  ${mark}  ${f.file}:${f.line}  ${f.kind} "${f.subject}"`);
    }
    if (!verbose && fileClaims.length > shown.length) {
      console.log(`  … ${fileClaims.length - shown.length} more (pass --verbose)`);
    }
    for (const f of fileContradicted) {
      console.log(`\n  ${f.file}:${f.line}  ${f.kind} "${f.subject}"`);
      console.log(`    in comment: ${f.excerpt.slice(0, 160)}`);
      console.log(
        `    reality: ${f.kind === 'landed-file' ? 'no such file' : 'file exists'} at ${f.resolvesTo}`,
      );
    }
    if (fileContradicted.length === 0) {
      console.log('  OK — every ✅ landed file exists, every PLANNED_* entry is genuinely absent');
    } else {
      console.log(
        `\n  ${fileContradicted.length} contradicted file claim(s). An inventory that\n` +
          '  names a file it does not have sends a reader to a missing file; one that\n' +
          '  lists a landed port as pending hides real work. Fix the list.',
      );
    }
    console.log('');
  };

  if (asJson) {
    // handled above
  } else {
    reportFileClaims();
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
  process.exit(contradicted.length + fileContradicted.length > 0 ? 1 : 0);
}

main();
