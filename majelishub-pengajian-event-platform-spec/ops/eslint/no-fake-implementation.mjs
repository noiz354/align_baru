/**
 * ESLint rule: `majelishub/no-fake-implementation` (T-ARCH-003).
 *
 * Where this belongs: `ops/eslint` - a build-time gate, not product code.
 * Specification: AGENTS.md §4.1/§5 ("no fake implementations"; unimplemented code throws
 *   `Not implemented: T-XXX` with a real TASKS.md id), DESIGN.md phase rule, TESTING.md §1.
 *
 * Enforced here:
 *   1. `constant-success`   a returned object literal that is nothing but constants and contains
 *                           `success: true` (or `ok: true`). A handler that answers success without
 *                           doing anything is the specific lie AGENTS.md §4.1 forbids.
 *   2. `missing-task-id`    a `throw new Error("Not implemented: ...")` with no `T-XXX-nnn` id.
 *   3. `unknown-task-id`    the id in such a throw does not exist in TASKS.md - a stub must point at
 *                           real, scheduled work, not at an invented identifier.
 *   4. `vague-todo`         a `test.todo`/`it.todo`/`describe.todo`/`test.fixme` title that states no
 *                           behaviour. The skeleton titles are the acceptance checklist (AGENTS.md
 *                           §5.4), so "works" is not a title. Heuristic, and deliberately narrow: the
 *                           title must be >= 12 characters and not a known placeholder word.
 *
 * The task catalogue is read from `TASKS.md` in the current working directory and cached; if it cannot
 * be read, task-id checks are skipped and a `catalogue-unreadable` problem is reported once, so a
 * broken environment can never look like a clean lint run.
 *
 * Failure cases: TASKS.md missing/unreadable (reported) · `Not implemented` inside a string that is not
 * thrown (not reported) · an object with any non-constant property (not reported - it computed
 * something).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TASK_ID = /T-[A-Z]{2,}-\d{3}/;
/** `matchAll` needs the global flag; the single-match form above is used for thrown messages. */
const TASK_ID_GLOBAL = /T-[A-Z]{2,}-\d{3}/g;
const VAGUE_TITLES = new Set(["works", "work", "ok", "todo", "tbd", "fixme", "test", "placeholder", "later"]);
const MIN_TITLE_LENGTH = 12;

let cache = null;

/** @param {string} cwd @returns {{ids: Set<string>, error: string|undefined}} */
function taskCatalogue(cwd) {
  if (cache !== null) return cache;
  try {
    const text = readFileSync(join(cwd, "TASKS.md"), "utf8");
    const ids = new Set();
    for (const match of text.matchAll(TASK_ID_GLOBAL)) ids.add(match[0]);
    cache = { ids, error: undefined };
  } catch (error) {
    cache = { ids: new Set(), error: error instanceof Error ? error.message : String(error) };
  }
  return cache;
}

/** Test hook: forget the cached TASKS.md parse. */
export function resetTaskCatalogueCache() {
  cache = null;
}

/** @param {import("estree").Expression} node */
function isConstant(node) {
  if (node.type === "Literal") return true;
  if (node.type === "TemplateLiteral") return node.expressions.every(isConstant);
  if (node.type === "UnaryExpression") return isConstant(node.argument);
  if (node.type === "ArrayExpression") return node.elements.every((el) => el !== null && isConstant(el));
  if (node.type === "ObjectExpression") {
    return node.properties.every(
      (property) => property.type === "Property" && isConstant(/** @type {import("estree").Expression} */ (property.value)),
    );
  }
  return false;
}

/** @param {import("estree").Property} property @param {string} name */
function propertyIsTrue(property, name) {
  if (property.type !== "Property") return false;
  const key = property.key;
  const keyName = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : undefined;
  return keyName === name && property.value.type === "Literal" && property.value.value === true;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid constant success-shaped returns and stubs that do not name a real task",
    },
    schema: [],
    messages: {
      constantSuccess:
        "A constant `{ {{ name }}: true }` return is a fake implementation (AGENTS.md §4.1): return the real result, or throw `Not implemented: T-XXX-nnn`.",
      missingTaskId:
        "An unimplemented path must throw `Not implemented: T-XXX-nnn` with a real TASKS.md id (AGENTS.md §4.1).",
      unknownTaskId: "`{{ id }}` is not defined in TASKS.md - a stub must point at scheduled work.",
      vagueTodo:
        "This todo title states no behaviour. Skeleton titles are the acceptance checklist (AGENTS.md §5.4).",
      catalogueUnreadable: "TASKS.md could not be read ({{ error }}): task ids were not validated.",
    },
  },

  /** @param {import("eslint").Rule.RuleContext} context */
  create(context) {
    const cwd = context.cwd ?? process.cwd();
    const catalogue = taskCatalogue(cwd);
    let catalogueReported = false;

    return {
      /** @param {import("estree").ReturnStatement} node */
      ReturnStatement(node) {
        const argument = node.argument;
        if (!argument || argument.type !== "ObjectExpression") return;
        if (argument.properties.length === 0) return;
        const successProperty = argument.properties.find((property) =>
          property.type === "Property"
            ? propertyIsTrue(property, "success") || propertyIsTrue(property, "ok")
            : false,
        );
        if (!successProperty || successProperty.type !== "Property") return;
        // Every property must be a constant: if anything is computed, the handler did real work.
        const allConstant = argument.properties.every(
          (property) => property.type === "Property" && isConstant(property.value),
        );
        if (!allConstant) return;
        const key = successProperty.key;
        const name = key.type === "Identifier" ? key.name : String(/** @type {import("estree").Literal} */ (key).value);
        context.report({ node, messageId: "constantSuccess", data: { name } });
      },

      /** @param {import("estree").ThrowStatement} node */
      ThrowStatement(node) {
        const argument = node.argument;
        if (argument.type !== "NewExpression") return;
        const callee = argument.callee;
        const isError =
          (callee.type === "Identifier" && callee.name === "Error") ||
          (callee.type === "MemberExpression" &&
            callee.property.type === "Identifier" &&
            callee.property.name === "Error");
        if (!isError) return;

        const first = argument.arguments[0];
        if (!first || first.type !== "Literal" || typeof first.value !== "string") return;
        const message = first.value;
        if (!/^Not implemented\b/i.test(message)) return;

        const match = TASK_ID.exec(message);
        if (!match) {
          context.report({ node, messageId: "missingTaskId" });
          return;
        }
        if (catalogue.error !== undefined) {
          if (!catalogueReported) {
            catalogueReported = true;
            context.report({ node, messageId: "catalogueUnreadable", data: { error: catalogue.error } });
          }
          return;
        }
        if (!catalogue.ids.has(match[0])) {
          context.report({ node, messageId: "unknownTaskId", data: { id: match[0] } });
        }
      },

      /** @param {import("estree").CallExpression} node */
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;
        const object = callee.object;
        const property = callee.property;
        if (object.type !== "Identifier" || !["test", "it", "describe"].includes(object.name)) return;
        if (property.type !== "Identifier" || !["todo", "fixme"].includes(property.name)) return;

        // `describe.todo("group", () => { ... })` is a container with real bodies inside; only a
        // titleless placeholder call (no body argument) is a skeleton title that must say something.
        if (node.arguments.length !== 1) return;
        const first = node.arguments[0];
        if (!first || first.type !== "Literal" || typeof first.value !== "string") return;
        const title = first.value.trim();
        const vague = title.length < MIN_TITLE_LENGTH || VAGUE_TITLES.has(title.toLowerCase());
        if (vague) context.report({ node, messageId: "vagueTodo" });
      },
    };
  },
};

export default rule;
