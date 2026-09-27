/**
 * UNIT TEST - lint/boundaries.test.ts
 * Layer: unit · Owning task: T-ARCH-002 · Requirement(s): NFR-OPS-001
 * Specification: ARCHITECTURE.md §4/§5 (layers and dependency rules), ADR-0002
 *
 * The fixtures are linted with the *same* flat config `npm run lint` uses (`eslint.config.mjs`), so
 * these tests prove the shipped configuration, not a copy of it.
 *
 * Delivered 2026-09-27 (T-ARCH-002).
 */
import { describe, expect, test } from "vitest";
import { Linter, type Linter as LinterTypes } from "eslint";
import { join } from "node:path";
import config from "../../../eslint.config.mjs";

const linter = new Linter({ configType: "flat" });

/** Lints `code` as if it lived at `path` inside this workspace, with the repository's own config. */
function lint(code: string, path: string): LinterTypes.LintMessage[] {
  return linter.verify(code, config, { filename: join(process.cwd(), path) });
}

function boundaryMessages(code: string, path: string): LinterTypes.LintMessage[] {
  return lint(code, path).filter((message) => message.ruleId === "majelishub/module-boundaries");
}

describe("module boundaries", () => {
  test("flags a domain module importing from features, server or app", () => {
    for (const source of ["@/features/events/service", "@/server/db/client", "@/app/api/v1/events/route"]) {
      const messages = boundaryMessages(`import { x } from "${source}";\nexport const y = x;\n`, "src/domain/event/policy.ts");
      expect(messages, `${source} should be refused`).toHaveLength(1);
      expect(messages[0]?.messageId).toBe("layer");
      expect(messages[0]?.message).toContain("ARCHITECTURE.md §5");
    }
  });

  test("flags a domain module importing a framework or runtime package", () => {
    for (const source of ["pg", "next/server", "react", "drizzle-orm", "better-auth", "node:fs"]) {
      const messages = boundaryMessages(`import x from "${source}";\nexport const y = x;\n`, "src/domain/event/policy.ts");
      expect(messages, `${source} should be refused in the domain layer`).toHaveLength(1);
      expect(messages[0]?.messageId).toBe("domainPackage");
    }
    // A pure library is still allowed: the domain layer may validate and compute.
    expect(boundaryMessages(`import { z } from "zod";\nexport const y = z;\n`, "src/domain/event/policy.ts")).toEqual([]);
  });

  test("allows features importing domain and shared contracts", () => {
    const messages = boundaryMessages(
      [
        `import { eventState } from "@/domain/event/state";`,
        `import { AppError } from "@/shared/contracts/errors";`,
        `export const go = () => [eventState, AppError];`,
        "",
      ].join("\n"),
      "src/features/events/service.ts",
    );
    expect(messages).toEqual([]);
  });

  test("allows a feature to reach another feature only through its published surface", () => {
    const internals = boundaryMessages(
      `import { x } from "@/features/registration/internal/tokens";\nexport const y = x;\n`,
      "src/features/events/service.ts",
    );
    expect(internals).toHaveLength(1);
    expect(internals[0]?.messageId).toBe("featureInternals");

    const published = boundaryMessages(
      `import { x } from "@/features/registration";\nexport const y = x;\n`,
      "src/features/events/service.ts",
    );
    expect(published).toEqual([]);

    // Own internals are, of course, allowed.
    expect(
      boundaryMessages(`import { x } from "@/features/events/internal/tokens";\nexport const y = x;\n`, "src/features/events/service.ts"),
    ).toEqual([]);
  });

  test("keeps server adapters out of app and features, and the Drizzle schema out of non-server code", () => {
    expect(
      boundaryMessages(`import { x } from "@/features/events/service";\nexport const y = x;\n`, "src/server/auth/session.ts"),
    ).toMatchObject([{ messageId: "layer" }]);
    expect(
      boundaryMessages(`import { x } from "@/app/layout";\nexport const y = x;\n`, "src/server/auth/session.ts"),
    ).toMatchObject([{ messageId: "layer" }]);

    // Server code may import domain and shared.
    expect(
      boundaryMessages(`import { x } from "@/domain/event/state";\nexport const y = x;\n`, "src/server/auth/session.ts"),
    ).toEqual([]);

    expect(
      boundaryMessages(`import { mosques } from "@/server/db/schema";\nexport const y = mosques;\n`, "src/features/mosques/service.ts"),
    ).toMatchObject([{ messageId: "schema" }]);
    expect(
      boundaryMessages(`import { mosques } from "@/server/db/schema";\nexport const y = mosques;\n`, "src/server/db/repositories/mosques.ts"),
    ).toEqual([]);
  });

  test("forbids a client component importing src/server/**", () => {
    const client = boundaryMessages(
      [`"use client";`, `import { pool } from "@/server/db/client";`, `export const y = pool;`, ""].join("\n"),
      "src/features/events/panel.tsx",
    );
    expect(client).toHaveLength(1);
    expect(client[0]?.messageId).toBe("clientServer");

    const serverComponent = boundaryMessages(
      `import { pool } from "@/server/db/client";\nexport const y = pool;\n`,
      "src/app/events/page.tsx",
    );
    expect(serverComponent).toEqual([]);
  });

  test("requires an inline disable to carry a written reason", () => {
    const bare = lint(
      [
        `// eslint-disable-next-line majelishub/module-boundaries`,
        `import { x } from "@/server/db/client";`,
        `export const y = x;`,
        "",
      ].join("\n"),
      "src/domain/event/policy.ts",
    ).filter((message) => message.ruleId === "majelishub/module-boundaries");
    expect(bare.map((message) => message.messageId)).toContain("bareDisable");

    const justified = lint(
      [
        `// eslint-disable-next-line majelishub/module-boundaries -- T-SEC-001: the guard needs the row it validates`,
        `import { x } from "@/server/db/client";`,
        `export const y = x;`,
        "",
      ].join("\n"),
      "src/domain/event/policy.ts",
    ).filter((message) => message.ruleId === "majelishub/module-boundaries");
    // The import itself is still reported (a disable comment only silences the next line's import),
    // but no bare-disable finding is raised.
    expect(justified.map((message) => message.messageId)).not.toContain("bareDisable");
  });

  test("the rule stays out of files that are not in a layer", () => {
    expect(boundaryMessages(`import { x } from "@/server/db/client";\nexport const y = x;\n`, "tests/support/db.ts")).toEqual([]);
    expect(boundaryMessages(`export const y = 1;\n`, "ops/docs-lint.mjs")).toEqual([]);
  });
});
