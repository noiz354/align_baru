/**
 * ESLint rule: `majelishub/module-boundaries` (T-ARCH-002).
 *
 * Where this belongs: `ops/eslint` - it is a build-time gate, not product code.
 * Specification: ARCHITECTURE.md §5 "Layers and dependency rules", ADR-0002.
 *
 * The dependency direction is a rule, not a preference:
 *
 *   src/app        routes, layouts, server actions (thin)
 *     └─> src/features/<mod>   feature UI, hooks, service implementations, DTO mappers, job handlers
 *           └─> src/domain/<entity>  pure domain: types, state machines, invariants, policy (no I/O)
 *                 └─> src/shared    contracts, validation, time, ui primitives
 *   src/server     adapters (db, storage, media, transcription, jobs, auth, telemetry) - implements
 *                  ports declared by features/domain; never imported by app or features UI... and
 *                  never imported by a client component.
 *
 * Enforced here:
 *   1. `domain` imports nothing from `features`, `server` or `app`, and no framework/runtime package
 *      (no `next`, `react`, `pg`, `drizzle-orm`, `better-auth`, no `node:fs`/`node:net`/`node:http`):
 *      a domain file that touches the network or the disk is not a domain file.
 *   2. `shared` imports nothing from `domain`, `features`, `server` or `app` (it is the bottom layer).
 *   3. `server` imports nothing from `app` or `features` (adapters implement ports, they do not call
 *      product code).
 *   4. `features` imports nothing from `app`.
 *   5. One feature may reach another feature only through its published surface
 *      (`src/features/<other>/index.ts`, i.e. `@/features/<other>`), never its internals.
 *   6. A client component (`"use client"`) may not import `src/server/**`.
 *   7. The Drizzle schema is imported only inside `src/server/**` (ARCHITECTURE.md §5: "No module may
 *      import the Drizzle schema directly except `src/server/db` and repository adapters" - read here
 *      as: only the adapter layer, so feature and domain code keeps speaking domain types).
 *
 * An inline `// eslint-disable-next-line majelishub/module-boundaries -- <reason>` is accepted, but
 * only with a written reason: a bare disable is reported (schema `requireReason`).
 *
 * Failure cases: an import the rule cannot classify is allowed (a missing rule must never block work
 * silently - it is visible in the rule's own tests); a disable without a reason is an error.
 */

const LAYERS = ["app", "features", "domain", "shared", "server"];

/**
 * Which layer each layer may import from (ARCHITECTURE.md §5). Note that `domain` may import `shared`
 * ONLY: `server` sits below the domain layer in the diagram but is made of adapters with I/O, and a
 * domain module that reaches an adapter is no longer pure.
 */
const ALLOWED_IMPORTS = {
  app: ["app", "features", "domain", "shared", "server"],
  features: ["features", "domain", "shared", "server"],
  domain: ["domain", "shared"],
  server: ["server", "domain", "shared"],
  shared: ["shared"],
};

/** Packages a pure domain module may not import. */
const DOMAIN_FORBIDDEN_PACKAGES = [
  "next",
  "react",
  "react-dom",
  "pg",
  "drizzle-orm",
  "drizzle-kit",
  "better-auth",
  "@better-auth/core",
  "@electric-sql/pglite",
  "@opentelemetry/api",
  "node:fs",
  "node:fs/promises",
  "node:net",
  "node:http",
  "node:https",
  "node:child_process",
];

/** @param {string} filePath absolute or workspace-relative path @returns {string|undefined} layer */
function layerOf(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  const index = normalized.indexOf("src/");
  if (index === -1) return undefined;
  const rest = normalized.slice(index + 4);
  const first = rest.split("/")[0];
  return LAYERS.includes(first) ? first : undefined;
}

/** @param {string} source import specifier @returns {string|undefined} layer the specifier points at */
function layerOfImport(source) {
  if (source.startsWith("@/")) return layerOf(`src/${source.slice(2)}`);
  if (source.startsWith(".")) return undefined; // resolved relative imports stay inside the layer
  return undefined;
}

function isSchemaImport(source) {
  return source === "@/server/db/schema" || source.startsWith("@/server/db/schema/");
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce the ARCHITECTURE.md §5 dependency direction between layers and features",
    },
    schema: [
      {
        type: "object",
        properties: {
          requireReason: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      layer: "{{ from }} code may not import {{ to }} code (`{{ source }}`) - ARCHITECTURE.md §5.",
      domainPackage:
        "Domain code may not import `{{ source }}`: the domain layer has no I/O and no framework (ARCHITECTURE.md §5).",
      featureInternals:
        "Import another feature through its published surface `@/features/{{ other }}`, never `{{ source }}`.",
      clientServer: "A client component may not import `{{ source }}` (ARCHITECTURE.md §5).",
      schema: "Only `src/server/**` may import the Drizzle schema (`{{ source }}`) - feature code speaks domain types.",
      bareDisable: "An inline disable of this rule must carry a written reason (`-- why`).",
    },
  },

  /** @param {import("eslint").Rule.RuleContext} context */
  create(context) {
    const filename = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
    const from = layerOf(filename);
    const options = context.options[0] ?? {};

    // Bare disables of this rule must state a reason.
    if (options.requireReason !== false) {
      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const comments = sourceCode.getAllComments();
      for (const comment of comments) {
        if (!/eslint-disable/.test(comment.value)) continue;
        if (!/majelishub\/module-boundaries/.test(comment.value)) continue;
        const [, after] = comment.value.split("--");
        if (!after || after.trim().length === 0) {
          context.report({ loc: comment.loc ?? { line: 1, column: 0 }, messageId: "bareDisable" });
        }
      }
    }

    if (from === undefined) return {};

    const inServer = filename.includes("/src/server/");

    /** @param {import("estree").Node} node @param {string} source */
    function check(node, source) {
      if (isSchemaImport(source) && !inServer) {
        context.report({ node, messageId: "schema", data: { source } });
        return;
      }

      const to = layerOfImport(source);

      if (to !== undefined && !ALLOWED_IMPORTS[from].includes(to)) {
        context.report({ node, messageId: "layer", data: { from, to, source } });
        return;
      }

      if (from === "domain") {
        const pkg = DOMAIN_FORBIDDEN_PACKAGES.find((name) => source === name || source.startsWith(`${name}/`));
        if (pkg) {
          context.report({ node, messageId: "domainPackage", data: { source } });
        }
      }

      // Cross-feature imports must go through the published surface.
      if (from === "features") {
        const own = filename.slice(filename.indexOf("src/features/") + 13).split("/")[0];
        const match = /^@\/features\/([^/]+)(\/.+)?$/.exec(source);
        if (match && match[1] && match[1] !== own && match[2]) {
          context.report({ node, messageId: "featureInternals", data: { other: match[1], source } });
        }
      }

      // Client components stay away from server adapters.
      if (to === "server") {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const directives = sourceCode.ast.body.filter(
          (statement) => statement.type === "ExpressionStatement" && statement.directive !== undefined,
        );
        const isClient = directives.some((statement) => statement.directive === "use client");
        if (isClient) {
          context.report({ node, messageId: "clientServer", data: { source } });
        }
      }
    }

    return {
      /** @param {import("estree").ImportDeclaration} node */
      ImportDeclaration(node) {
        if (typeof node.source.value === "string") check(node, node.source.value);
      },
      /** @param {import("estree").ExportNamedDeclaration | import("estree").ExportAllDeclaration} node */
      ExportNamedDeclaration(node) {
        if (node.source && typeof node.source.value === "string") check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.source && typeof node.source.value === "string") check(node, node.source.value);
      },
      /** @param {import("estree").ImportExpression} node */
      ImportExpression(node) {
        if (node.source.type === "Literal" && typeof node.source.value === "string") {
          check(node, node.source.value);
        }
      },
    };
  },
};

export default rule;
