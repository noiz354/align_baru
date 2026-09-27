/**
 * UNIT TEST - lint/no-fake.test.ts
 * Layer: unit · Owning task: T-ARCH-003 · Requirement(s): NFR-OPS-001
 * Specification: AGENTS.md §4.1/§5 (no fake implementations), DESIGN.md phase rule, TESTING.md §1
 *
 * Lints fixtures with the repository's own `eslint.config.mjs`. The task-id check reads the real
 * TASKS.md, so the "known id" case uses an id that actually exists in it.
 *
 * Delivered 2026-09-27 (T-ARCH-003).
 */
import { describe, expect, test } from "vitest";
import { Linter, type Linter as LinterTypes } from "eslint";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import config from "../../../eslint.config.mjs";

const linter = new Linter({ configType: "flat" });

function noFake(code: string, path = "src/app/api/v1/thing/route.ts"): LinterTypes.LintMessage[] {
  return linter
    .verify(code, config, { filename: join(process.cwd(), path) })
    .filter((message) => message.ruleId === "majelishub/no-fake-implementation");
}

describe("no fake implementations", () => {
  test("flags a constant success-shaped return in src/**", () => {
    for (const body of [
      "export function POST() {\n  return { success: true };\n}\n",
      "export function POST() {\n  return { ok: true, message: \"done\" };\n}\n",
      "export function POST() {\n  return { success: true, count: 0 };\n}\n",
    ]) {
      const messages = noFake(body);
      expect(messages, body).toHaveLength(1);
      expect(messages[0]?.messageId).toBe("constantSuccess");
      expect(messages[0]?.message).toContain("AGENTS.md §4.1");
    }
  });

  test("flags a stub whose Not implemented task ID does not exist in TASKS.md", () => {
    const unknown = noFake('export function POST(): never {\n  throw new Error("Not implemented: T-NOPE-999");\n}\n');
    expect(unknown).toHaveLength(1);
    expect(unknown[0]?.messageId).toBe("unknownTaskId");

    const noId = noFake('export function POST(): never {\n  throw new Error("Not implemented");\n}\n');
    expect(noId).toHaveLength(1);
    expect(noId[0]?.messageId).toBe("missingTaskId");

    // A real, scheduled task id is the sanctioned shape and must pass.
    const realId =
      Array.from(readFileSync(join(process.cwd(), "TASKS.md"), "utf8").matchAll(/\bT-[A-Z]{2,}-\d{3}\b/g))[0]?.[0] ?? "";
    expect(realId.length).toBeGreaterThan(0);
    expect(noFake(`export function POST(): never {\n  throw new Error("Not implemented: ${realId}");\n}\n`)).toEqual([]);

    // The phrase in prose or in an unrelated error is not a stub.
    expect(noFake('export const note = "Not implemented behaviour is listed in TASKS.md";\n')).toEqual([]);
    expect(noFake('export function go(): never {\n  throw new Error("boom: T-NOPE-999");\n}\n')).toEqual([]);
  });

  test("flags a todo test whose title states no behaviour", () => {
    for (const title of ["works", "ok", "todo", "later", ""]) {
      const messages = noFake(`test.todo(${JSON.stringify(title)});\n`, "tests/unit/thing.test.ts");
      expect(messages, JSON.stringify(title)).toHaveLength(1);
      expect(messages[0]?.messageId).toBe("vagueTodo");
    }
    // A title that says what must happen is the acceptance checklist and passes.
    expect(
      noFake('test.todo("reports a file in docs/adr/ that is missing from the ADR index");\n', "tests/unit/thing.test.ts"),
    ).toEqual([]);
    // A container with real bodies inside is not a skeleton title.
    expect(noFake('describe.todo("module boundaries", () => {\n  test("x", () => {});\n});\n', "tests/unit/thing.test.ts")).toEqual([]);
  });

  test("does not flag a legitimate pure helper that returns a computed value", () => {
    expect(
      noFake(
        [
          "export function summarize(rows: { arrived: boolean }[]) {",
          "  const arrived = rows.filter((row) => row.arrived).length;",
          "  return { success: arrived === rows.length, arrived, total: rows.length };",
          "}",
          "",
        ].join("\n"),
      ),
    ).toEqual([]);
    expect(noFake("export function add(a: number, b: number) {\n  return { total: a + b };\n}\n")).toEqual([]);
    // `success` computed from something is not a lie.
    expect(noFake("export function go(flag: boolean) {\n  return { success: flag };\n}\n")).toEqual([]);
  });
});
