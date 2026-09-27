/**
 * ESLint rule: `majelishub/no-token-logging` (T-SEC-004).
 *
 * Where this belongs: `ops/eslint` - a build-time gate, not product code.
 * Specification: OBSERVABILITY.md §7 (forbidden in telemetry), docs/security/QR-SECURITY.md,
 *   ADR-0006 (opaque tokens), TASKS.md T-SEC-004, THREAT_MODEL T-18.
 *
 * The runtime guard in `src/shared/observability/logger.ts` drops banned attributes and counts them.
 * This rule stops them being written in the first place, and it reads the SAME data file
 * (`src/shared/observability/banned-attributes.json`) as the runtime, which is the invariant T-SEC-004
 * states: one ban list, two enforcers, no drift.
 *
 * Reported inside a logging call (`logger.debug|info|warn|error(...)`):
 *   1. `bannedField`      an object-literal property whose NAME matches the ban list
 *                        (`{ token: … }`, `{ invitation_code: … }`, `{ presignedUrl: … }`).
 *   2. `bannedValue`      a variable/property reference whose NAME matches the ban list, even when it is
 *                        passed under an allowed key (`{ result: checkinToken }`).
 *   3. `interpolatedMessage`  a message built by template interpolation or concatenation. The message is
 *                        a fixed event name; interpolation is how a value ends up in a log line.
 *   4. `nonLiteralMessage`    a message that is not a string literal at all.
 *
 * Not reported: names on the allow-list (`errorCode`, `transcriptId`) even though they contain a banned
 * pattern - the allow-list is checked first, exactly as at runtime.
 *
 * Failure cases: the ban list file missing/unreadable -> one `banListUnreadable` problem, so a broken
 * environment can never look like a clean lint run (same shape as `no-fake-implementation`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_BAN_LIST_PATH = join("src", "shared", "observability", "banned-attributes.json");
const LOG_METHODS = new Set(["debug", "info", "warn", "error"]);
const LOGGER_NAMES = /^(logger|log)$/;

let cache = null;

/**
 * @param {string} cwd
 * @param {string} relativePath path of the ban list, relative to `cwd` (a rule option, so the
 *   unreadable-list failure path is testable)
 * @returns {{patterns: {match: string, reason: string, except?: string[]}[], error: string|undefined}}
 */
function banList(cwd, relativePath) {
  if (cache && cache.path === relativePath) return cache;
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, relativePath), "utf8"));
    cache = { path: relativePath, patterns: parsed.banned ?? [], error: undefined };
  } catch (error) {
    cache = { path: relativePath, patterns: [], error: `${relativePath} could not be read: ${error.message}` };
  }
  return cache;
}

/** Test seam: forgets the cached ban list so a test can exercise the unreadable path. */
export function resetBanListCache() {
  cache = null;
}

/**
 * Splits an identifier into lowercase words, identically to
 * `identifierWords` in src/shared/observability/attributes.ts. Both read the same JSON, and
 * tests/unit/observability/token-logging.test.ts asserts they classify the same names the same way -
 * that test is what keeps these two implementations from drifting apart.
 *
 * @param {string} name
 * @returns {string[]}
 */
function identifierWords(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1\u0000$2")
    .split(/[\u0000_\-\s.]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

/**
 * @param {string} name
 * @param {{patterns: {match: string, reason: string, except?: string[]}[]}} list
 * @returns {string|undefined} the reason the name is banned
 */
function bannedReason(name, list) {
  const lower = name.toLowerCase();
  const words = identifierWords(name);
  for (const pattern of list.patterns) {
    if ((pattern.except ?? []).some((exception) => exception.toLowerCase() === lower)) continue;
    if (words.includes(pattern.match) || lower === pattern.match) return pattern.reason;
  }
  return undefined;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Token, code and personal-data field names must never reach telemetry",
    },
    schema: [
      {
        type: "object",
        properties: { banListPath: { type: "string" } },
        additionalProperties: false,
      },
    ],
    messages: {
      bannedField:
        "Telemetry may not carry \"{{name}}\": {{reason}}. Log an opaque id and an outcome instead (OBSERVABILITY.md §7, T-SEC-004).",
      bannedValue:
        "\"{{name}}\" matches the telemetry ban list: {{reason}}. It must not be logged, even under an allowed key (T-SEC-004).",
      interpolatedMessage:
        "A log message is a fixed event name, not interpolated text - a value interpolated here is a value in the log (OBSERVABILITY.md §5, T-SEC-004).",
      nonLiteralMessage:
        "A log message must be a string literal event name such as \"checkin.committed\" (OBSERVABILITY.md §5, T-SEC-004).",
      banListUnreadable: "{{message}}",
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const list = banList(context.cwd ?? process.cwd(), options.banListPath ?? DEFAULT_BAN_LIST_PATH);
    if (list.error) {
      return {
        Program(node) {
          context.report({ node, messageId: "banListUnreadable", data: { message: list.error } });
        },
      };
    }

    /** @param {import("estree").CallExpression} node */
    function isLogCall(node) {
      const callee = node.callee;
      return (
        callee.type === "MemberExpression" &&
        !callee.computed &&
        callee.property.type === "Identifier" &&
        LOG_METHODS.has(callee.property.name) &&
        callee.object.type === "Identifier" &&
        LOGGER_NAMES.test(callee.object.name)
      );
    }

    /** @param {import("estree").Node} node */
    function checkMessage(node) {
      if (node.type === "TemplateLiteral") {
        if (node.expressions.length > 0) {
          context.report({ node, messageId: "interpolatedMessage" });
        }
        return;
      }
      if (node.type !== "Literal" || typeof node.value !== "string") {
        context.report({ node, messageId: "nonLiteralMessage" });
      }
    }

    /** @param {import("estree").Node} node */
    function walk(node) {
      switch (node.type) {
        case "ObjectExpression": {
          for (const property of node.properties) {
            if (property.type !== "Property") continue;
            const key = property.key;
            const name =
              key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : undefined;
            if (name) {
              const reason = bannedReason(name, list);
              if (reason) {
                context.report({ node: key, messageId: "bannedField", data: { name, reason } });
              }
            }
            // Shorthand `{ token }` is both a key and a value; walking the value covers the reference.
            walk(property.value);
          }
          return;
        }
        case "Identifier": {
          const reason = bannedReason(node.name, list);
          if (reason) {
            context.report({ node, messageId: "bannedValue", data: { name: node.name, reason } });
          }
          return;
        }
        case "MemberExpression": {
          walk(node.object);
          // `request.token` - the property name is the tell, and it is not a scope reference.
          if (!node.computed && node.property.type === "Identifier") {
            const reason = bannedReason(node.property.name, list);
            if (reason) {
              context.report({
                node: node.property,
                messageId: "bannedValue",
                data: { name: node.property.name, reason },
              });
            }
          }
          return;
        }
        case "TemplateLiteral": {
          for (const expression of node.expressions) walk(expression);
          return;
        }
        case "CallExpression":
        case "NewExpression": {
          for (const argument of node.arguments) walk(argument);
          return;
        }
        case "ConditionalExpression": {
          walk(node.consequent);
          walk(node.alternate);
          return;
        }
        case "ArrayExpression": {
          for (const element of node.elements) if (element) walk(element);
          return;
        }
        default:
          return;
      }
    }

    return {
      /** @param {import("estree").CallExpression} node */
      CallExpression(node) {
        if (!isLogCall(node)) return;
        const [message, attributes, error] = node.arguments;
        if (message) checkMessage(message);
        if (attributes) walk(attributes);
        if (error) walk(error);
      },
    };
  },
};

export default rule;
