/**
 * Documentation consistency gate (T-DOCS-001).
 *
 * Runs in CI (`npm run docs:lint`) and locally; fails when the authoritative documentation becomes
 * self-contradictory. Read-only by design: it never rewrites a document - a finding is fixed in the
 * offending document, because the documentation is the contract for later agents (AGENTS.md §1).
 *
 * Checks
 *   1. `adr-index`      every `docs/adr/ADR-####-*.md` file is listed in the ADR index. The index is
 *                      `ADR.md` at the repository root; `docs/adr/README.md` is accepted as a fallback.
 *   2. `requirement-id` every `FR-*-*` / `NFR-*-*` id cited anywhere is defined in PRD.md.
 *   3. `doc-path`       every cited `docs/**.md` path and every cited document name written in capitals
 *                      resolves to a real file.
 *   4. `task-id`        every `T-XXX-###` id cited anywhere is defined in TASKS.md (AGENTS.md §4.2:
 *                      an unimplemented behaviour must name a real task).
 *   5. `empty-doc`      no document without a single heading.
 *   6. The logic itself is unit-tested in `tests/unit/docs/references.test.ts`, which runs these
 *      functions against fixtures and against this repository (zero findings required).
 *
 * Failure cases: unreadable file (reported as `read-error`, not skipped silently) · missing PRD/TASKS
 * (reported, because every other check would then be vacuous) · no documents found at all (reported).
 *
 * Task ownership: T-DOCS-001 (delivered 2026-09-27).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** File names/roots that are never documentation. */
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "coverage", "dist", "build", ".arena"]);

const REQUIREMENT_ID = /\b(?:FR|NFR)-[A-Z]{2,}-\d{3}\b/g;
const TASK_ID = /\bT-[A-Z]{2,}-\d{3}\b/g;
const DOCS_PATH = /(?:^|[^A-Za-z0-9._/-])(docs\/[A-Za-z0-9._/-]+\.md)\b/g;
/** A cited document by name (`API.md`, `SECURITY.md`, ...). Only ALL-CAPS names are treated as citations. */
const DOC_NAME = /(?:^|[^A-Za-z0-9._/-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\.md)\b/g;

export const RULES = Object.freeze({
  ADR_INDEX: "adr-index",
  REQUIREMENT_ID: "requirement-id",
  DOC_PATH: "doc-path",
  TASK_ID: "task-id",
  EMPTY_DOC: "empty-doc",
  STRUCTURE: "structure",
});

/**
 * Files exempt from the REFERENCE checks (`requirement-id`, `doc-path`, `task-id`), with the reason.
 *
 * Only the gate's own fixtures qualify: they must contain identifiers that do NOT exist, otherwise they
 * cannot prove the checks fire. The exemption is narrow (those three rules, those files) and visible in
 * this list rather than hidden in an inline comment, and `tests/unit/docs/references.test.ts` asserts the
 * rest of the repository still yields zero findings.
 */
export const REFERENCE_EXEMPTIONS = Object.freeze([
  { path: "tests/unit/docs/references.test.ts", reason: "gate fixtures: deliberately invalid ids and paths" },
  { path: "tests/unit/lint/no-fake.test.ts", reason: "lint-rule fixtures: deliberately invalid task ids" },
]);

/** @typedef {{rule: string, file: string, line: number, message: string}} Finding */
/** @typedef {{root: string, documents: string[], findings: Finding[]}} ScanResult */

/**
 * Recursively lists files under `root`, skipping ignored directories.
 * @param {string} root
 * @param {(name: string) => boolean} keep
 * @param {string[]} [out]
 * @returns {string[]} absolute paths
 */
function walk(root, keep, out = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(join(root, entry.name), keep, out);
      continue;
    }
    if (entry.isFile() && keep(entry.name)) out.push(join(root, entry.name));
  }
  return out;
}

const isMarkdown = (name) => name.endsWith(".md");
const isScannedSource = (name) =>
  name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mjs") || name.endsWith(".sql") || name.endsWith(".json");

/**
 * @param {string} file absolute path
 * @returns {string[]} lines
 */
function readLines(file) {
  return readFileSync(file, "utf8").split(/\r?\n/);
}

/** @param {string} root @param {string} file @returns {string} repo-relative, forward-slash path */
const rel = (root, file) => relative(root, file).split(sep).join("/");

/**
 * Collects every finding. Pure: it reads files and returns data, so tests can point it at a fixture.
 * @param {string} root repository (or fixture) root
 * @param {{exemptions?: {path: string, reason: string}[]}} [options]
 * @returns {ScanResult}
 */
export function collectFindings(root, options = {}) {
  /** @type {Finding[]} */
  const findings = [];
  const add = (rule, file, line, message) => findings.push({ rule, file: rel(root, file), line, message });

  const documents = walk(root, isMarkdown);
  const sources = walk(root, (name) => isMarkdown(name) || isScannedSource(name));
  if (documents.length === 0) {
    add(RULES.STRUCTURE, ".", 0, "no markdown documents found under the scan root");
    return { root, documents, findings };
  }

  const prd = join(root, "PRD.md");
  const tasks = join(root, "TASKS.md");
  const adrDir = join(root, "docs", "adr");

  const definedRequirements = new Set();
  const definedTasks = new Set();

  // Definitions come from the two authoritative catalogues only.
  if (!exists(prd)) add(RULES.STRUCTURE, "PRD.md", 0, "PRD.md is missing: requirement ids cannot be validated");
  else for (const id of readFileSync(prd, "utf8").matchAll(REQUIREMENT_ID)) definedRequirements.add(id[0]);

  if (!exists(tasks)) add(RULES.STRUCTURE, "TASKS.md", 0, "TASKS.md is missing: task ids cannot be validated");
  else for (const id of readFileSync(tasks, "utf8").matchAll(TASK_ID)) definedTasks.add(id[0]);

  // Every document name that exists anywhere under the root, for `doc-path` resolution.
  const knownDocNames = new Set(documents.map((file) => file.split(sep).pop()));

  // 1. ADR index completeness. The index is the root `ADR.md`; `docs/adr/README.md` is a fallback.
  if (isDirectory(adrDir)) {
    const candidates = [join(root, "ADR.md"), join(adrDir, "README.md")];
    const indexFile = candidates.find((candidate) => exists(candidate));
    if (indexFile === undefined) {
      add(RULES.ADR_INDEX, "docs/adr", 0, "no ADR index found (expected ADR.md or docs/adr/README.md)");
    } else {
      const indexText = readFileSync(indexFile, "utf8");
      const indexName = rel(root, indexFile);
      for (const entry of readdirSync(adrDir, { withFileTypes: true })) {
        if (!entry.isFile() || !/^ADR-\d{4}-[\w-]+\.md$/.test(entry.name)) continue;
        if (!indexText.includes(entry.name)) {
          add(RULES.ADR_INDEX, `docs/adr/${entry.name}`, 1, `${entry.name} is not listed in ${indexName}`);
        }
      }
    }
  }

  const exemptions = options.exemptions ?? REFERENCE_EXEMPTIONS;

  for (const file of sources) {
    const relativePath = rel(root, file);
    const skipReferences = exemptions.some((exemption) => relativePath === exemption.path);
    /** @type {string[]} */
    let lines;
    try {
      lines = readLines(file);
    } catch (error) {
      add(RULES.STRUCTURE, rel(root, file), 0, `unreadable: ${String(error instanceof Error ? error.message : error)}`);
      continue;
    }

    // 5. Empty document.
    if (file.endsWith(".md")) {
      if (!lines.some((line) => /^#{1,6}\s+\S/.test(line))) {
        add(RULES.EMPTY_DOC, rel(root, file), 1, "document has no heading");
      }
    }

    if (skipReferences) continue;

    lines.forEach((line, index) => {
      const lineNo = index + 1;

      // 2. Requirement ids must be defined in PRD.md.
      for (const match of line.matchAll(REQUIREMENT_ID)) {
        if (!definedRequirements.has(match[0])) {
          add(RULES.REQUIREMENT_ID, rel(root, file), lineNo, `${match[0]} is not defined in PRD.md`);
        }
      }

      // 4. Task ids must be defined in TASKS.md.
      for (const match of line.matchAll(TASK_ID)) {
        if (!definedTasks.has(match[0])) {
          add(RULES.TASK_ID, rel(root, file), lineNo, `${match[0]} is not defined in TASKS.md`);
        }
      }

      // 3a. Cited docs/** paths must exist.
      for (const match of line.matchAll(DOCS_PATH)) {
        const cited = match[1];
        if (!cited || !exists(join(root, cited))) {
          add(RULES.DOC_PATH, rel(root, file), lineNo, `cited path does not exist: ${cited}`);
        }
      }

      // 3b. Cited document names (API.md, SECURITY.md, ...) must exist somewhere under the root.
      for (const match of line.matchAll(DOC_NAME)) {
        const cited = match[1];
        if (!cited) continue;
        // Relative citations are already covered by 3a; only bare names are checked here.
        if (line.includes(`docs/${cited}`)) continue;
        if (!knownDocNames.has(cited)) {
          add(RULES.DOC_PATH, rel(root, file), lineNo, `cited document does not exist: ${cited}`);
        }
      }
    });
  }

  return { root, documents, findings };
}

/** @param {string} path @returns {boolean} true when the path is an existing regular file */
function exists(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** @param {string} path @returns {boolean} true when the path is an existing directory */
function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** @param {Finding[]} findings @returns {string} */
export function formatFindings(findings) {
  if (findings.length === 0) return "docs-lint: 0 findings\n";
  const lines = findings.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.message}`);
  return `docs-lint: ${findings.length} finding(s)\n${lines.sort().join("\n")}\n`;
}

/**
 * CLI entry. Exit code 1 when any finding exists, 0 when the documentation is consistent.
 * @param {string[]} argv process.argv
 * @param {{cwd?: string, write?: (chunk: string) => void}} [io]
 * @returns {number} exit code
 */
export function run(argv, io = {}) {
  const root = io.cwd ?? process.cwd();
  const write = io.write ?? ((chunk) => process.stdout.write(chunk));
  const { findings } = collectFindings(root);
  const asJson = argv.includes("--json");
  write(asJson ? `${JSON.stringify(findings, null, 2)}\n` : formatFindings(findings));
  if (findings.length === 0) return 0;
  // Machine-readable output must stay parseable, so the hint goes to stderr in --json mode.
  if (asJson) process.stderr.write("Fix the offending document - this gate never rewrites documents.\n");
  else write("Fix the offending document - this gate never rewrites documents.\n");
  return 1;
}

const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  process.argv[1].replace(/\\/g, "/").endsWith("ops/docs-lint.mjs");

if (invokedDirectly) {
  process.exitCode = run(process.argv);
}
