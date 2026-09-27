/**
 * UNIT TEST - docs/references.test.ts
 * Layer: unit · Owning task: T-DOCS-001 · Requirement(s): NFR-OPS-001
 * Specification: TASKS.md T-DOCS-001, AGENTS.md §1/§11 (documentation is authoritative)
 *
 * The gate is exercised against throw-away fixtures, so a "finding" here means the check itself works;
 * the last test points it at this repository and requires zero findings, which is what CI enforces.
 *
 * Delivered 2026-09-27 (T-DOCS-001).
 */
import { afterAll, describe, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectFindings, formatFindings, run, REFERENCE_EXEMPTIONS, RULES } from "../../../ops/docs-lint.mjs";

const REPO_ROOT = process.cwd();
const fixtures: string[] = [];

afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true });
});

/**
 * A minimal but valid documentation tree. Every fixture starts consistent, and each test breaks exactly
 * one rule, so a finding can only come from the intended defect.
 */
function fixture(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "docs-lint-"));
  fixtures.push(root);
  const base: Record<string, string> = {
    "PRD.md": "# PRD\n\n| FR-CHECKIN-001 | P0 | Scan a token. |\n| NFR-SEC-002 | P0 | Cross-org access is a 404. |\n",
    "TASKS.md": "# TASKS\n\n## T-SEC-002 authorization\n\n## T-DOCS-001 docs gate\n",
    "ADR.md": "# ADR index\n\n| ADR | Title |\n|---|---|\n| [0001](docs/adr/ADR-0001-record-architecture-decisions.md) | Record ADRs |\n",
    "docs/adr/README.md": "# Architecture Decision Records\n\nThe index lives in `ADR.md`.\n",
    "docs/adr/ADR-0001-record-architecture-decisions.md": "# ADR-0001\n\nStatus: accepted.\n",
    "docs/security/AUTHZ-MATRIX.md": "# AUTHZ-MATRIX\n\nEnforced by T-SEC-002 against FR-CHECKIN-001.\n",
    "README.md": "# README\n\nSee docs/security/AUTHZ-MATRIX.md and PRD.md.\n",
    ...files,
  };
  for (const [path, contents] of Object.entries(base)) {
    const full = join(root, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, contents, "utf8");
  }
  return root;
}

function rulesFor(root: string, rule: string): string[] {
  return collectFindings(root).findings.filter((f) => f.rule === rule).map((f) => `${f.file}:${f.line} ${f.message}`);
}

describe("docs lint", () => {
  test("is consistent on the fixture itself (control)", () => {
    const root = fixture();
    expect(collectFindings(root).findings).toEqual([]);
  });

  test("reports a file in docs/adr/ that is missing from the ADR index", () => {
    const root = fixture({
      "docs/adr/ADR-0002-postgresql-as-system-of-record.md": "# ADR-0002\n\nStatus: accepted.\n",
    });
    const findings = rulesFor(root, RULES.ADR_INDEX);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("ADR-0002-postgresql-as-system-of-record.md");
    expect(findings[0]).toContain("ADR.md");
  });

  test("reports a requirement ID referenced anywhere but not defined in PRD.md", () => {
    const root = fixture({
      "src/server/thing.ts": "// Owning task: T-SEC-002 · Requirement(s): FR-NOPE-999\nexport const x = 1;\n",
    });
    const findings = rulesFor(root, RULES.REQUIREMENT_ID);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("src/server/thing.ts:1");
    expect(findings[0]).toContain("FR-NOPE-999");
  });

  test("reports a cited docs/** path that does not exist", () => {
    const root = fixture({
      "README.md": "# README\n\nSee docs/security/MISSING.md for details.\n",
    });
    const findings = rulesFor(root, RULES.DOC_PATH);
    expect(findings.some((f) => f.includes("docs/security/MISSING.md"))).toBe(true);
  });

  test("reports a task ID referenced anywhere but not defined in TASKS.md", () => {
    const root = fixture({
      "src/server/thing.ts": 'export function go(): never {\n  throw new Error("Not implemented: T-NOPE-999");\n}\n',
    });
    const findings = rulesFor(root, RULES.TASK_ID);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("T-NOPE-999");
  });

  test("reports an empty document (no headings)", () => {
    const root = fixture({ "docs/design/EMPTY.md": "just prose, no heading at all\n" });
    const findings = rulesFor(root, RULES.EMPTY_DOC);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("docs/design/EMPTY.md");
  });

  test("reports a scan root with no documents, and an unreadable catalogue", () => {
    const empty = mkdtempSync(join(tmpdir(), "docs-lint-empty-"));
    fixtures.push(empty);
    const findings = collectFindings(empty).findings;
    expect(findings.some((f) => f.rule === RULES.STRUCTURE && f.message.includes("no markdown documents"))).toBe(true);

    const noPrd = fixture();
    rmSync(join(noPrd, "PRD.md"));
    rmSync(join(noPrd, "TASKS.md"));
    const missing = collectFindings(noPrd).findings;
    expect(missing.some((f) => f.message.includes("PRD.md is missing"))).toBe(true);
    expect(missing.some((f) => f.message.includes("TASKS.md is missing"))).toBe(true);
  });

  test("CLI exits 1 with findings and 0 without, and --json emits the findings", () => {
    const bad = fixture({ "README.md": "# README\n\nCites T-NOPE-999.\n" });
    let output = "";
    expect(run([], { cwd: bad, write: (chunk) => (output += chunk) })).toBe(1);
    expect(output).toContain("1 finding(s)");

    let json = "";
    expect(run(["--json"], { cwd: bad, write: (chunk) => (json += chunk) })).toBe(1);
    expect(JSON.parse(json)[0]).toMatchObject({ rule: RULES.TASK_ID, message: expect.stringContaining("T-NOPE-999") });

    const good = fixture();
    let clean = "";
    expect(run([], { cwd: good, write: (chunk) => (clean += chunk) })).toBe(0);
    expect(clean).toContain("0 findings");
  });

  test("the reference exemption covers only this file, and only the reference rules", () => {
    expect(REFERENCE_EXEMPTIONS.map((e) => e.path)).toEqual([
      "tests/unit/docs/references.test.ts",
      "tests/unit/lint/no-fake.test.ts",
    ]);
    for (const exemption of REFERENCE_EXEMPTIONS) {
      expect(exemption.reason.length).toBeGreaterThan(10);
    }
    // Turning the exemption off must surface this file's fixtures - proof the checks do fire here.
    const exemptPaths = REFERENCE_EXEMPTIONS.map((e) => e.path);
    const findings = collectFindings(REPO_ROOT, { exemptions: [] }).findings;
    const inExemptFiles = findings.filter((f) => exemptPaths.includes(f.file));
    expect(inExemptFiles.length).toBeGreaterThan(0);
    expect(
      inExemptFiles.every((f) => [RULES.TASK_ID, RULES.REQUIREMENT_ID, RULES.DOC_PATH].includes(f.rule as never)),
    ).toBe(true);
    // ...and nothing else in the repository is affected either way.
    expect(findings.filter((f) => !exemptPaths.includes(f.file))).toEqual([]);
  });

  test("passes on the current repository with zero findings", () => {
    const { findings, documents } = collectFindings(REPO_ROOT);
    expect(documents.length).toBeGreaterThan(40);
    // The whole point of the gate: this repository is its own acceptance case.
    expect(formatFindings(findings)).toBe("docs-lint: 0 findings\n");
    expect(findings).toEqual([]);
  });
});
