/**
 * UNIT TEST - lint/console-ban.test.ts
 * Layer: unit · Owning task: T-OBS-002 · Requirement(s): NFR-OBS-002
 * Specification: OBSERVABILITY.md §5 (exactly one logging interface)
 *
 * Lints fixtures with the repository's own `eslint.config.mjs`, including the bootstrap exemption that
 * the shipped config declares - so the exemption cannot widen unnoticed.
 *
 * Delivered 2026-09-27 (T-OBS-002 lint half; the structured logger itself and the field allow-list are
 * delivered with the same task's runtime work).
 */
import { describe, expect, test } from "vitest";
import { Linter, type Linter as LinterTypes } from "eslint";
import { join } from "node:path";
import config from "../../../eslint.config.mjs";

const linter = new Linter({ configType: "flat" });

function consoleErrors(code: string, path: string): LinterTypes.LintMessage[] {
  return linter
    .verify(code, config, { filename: join(process.cwd(), path) })
    .filter((message) => message.ruleId === "no-console");
}

const CODE = [
  'export function announce(text: string): void {',
  '  console.log(text);',
  '  console.error(text);',
  "}",
  "",
].join("\n");

describe("console ban", () => {
  test("flags console.* outside src/server/bootstrap/**", () => {
    for (const path of [
      "src/features/events/service.ts",
      "src/server/auth/session.ts",
      "src/shared/observability/logger.ts",
      "src/app/api/v1/events/route.ts",
      "tests/support/db.ts",
    ]) {
      const messages = consoleErrors(CODE, path);
      expect(messages, path).toHaveLength(2);
      expect(messages[0]?.message).toContain("console");
    }
  });

  test("allows console output inside the bootstrap module", () => {
    expect(consoleErrors(CODE, "src/server/bootstrap/logger.ts")).toEqual([]);
    expect(consoleErrors(CODE, "src/server/bootstrap/instrumentation.ts")).toEqual([]);
  });

  test("the structured escape hatch is not console", () => {
    // The sanctioned way to write to stdout without going through console.* (see
    // src/server/auth/authorization-events.ts) stays allowed everywhere.
    const code = ['export function emit(line: string): void {', "  process.stdout.write(`${line}\\n`);", "}", ""].join("\n");
    expect(consoleErrors(code, "src/shared/observability/logger.ts")).toEqual([]);
  });
});
