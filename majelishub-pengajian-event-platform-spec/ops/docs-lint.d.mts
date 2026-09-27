/**
 * Type surface of the documentation gate, so TypeScript tests can import the `.mjs` CLI without
 * turning `allowJs` on for the whole project (tsconfig keeps `allowJs: false` deliberately:
 * production code is TypeScript, this ops script is a standalone Node CLI).
 *
 * Keep in sync with `ops/docs-lint.mjs`. Owning task: T-DOCS-001.
 */
export interface DocsLintFinding {
  readonly rule: string;
  /** Repo-relative path, forward slashes. */
  readonly file: string;
  /** 1-based line; 0 when the finding is about the file as a whole. */
  readonly line: number;
  readonly message: string;
}

export interface DocsLintScanResult {
  readonly root: string;
  readonly documents: readonly string[];
  readonly findings: readonly DocsLintFinding[];
}

export declare const RULES: {
  readonly ADR_INDEX: "adr-index";
  readonly REQUIREMENT_ID: "requirement-id";
  readonly DOC_PATH: "doc-path";
  readonly TASK_ID: "task-id";
  readonly EMPTY_DOC: "empty-doc";
  readonly STRUCTURE: "structure";
};

export declare const REFERENCE_EXEMPTIONS: ReadonlyArray<{ readonly path: string; readonly reason: string }>;

export declare function collectFindings(
  root: string,
  options?: { exemptions?: ReadonlyArray<{ path: string; reason: string }> },
): DocsLintScanResult;
export declare function formatFindings(findings: readonly DocsLintFinding[]): string;
export declare function run(
  argv: readonly string[],
  io?: { cwd?: string; write?: (chunk: string) => void },
): number;
