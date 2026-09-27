/**
 * Telemetry attribute policy - the allow-list, and the shared ban list.
 *
 * Where this belongs: shared/observability, because every layer logs.
 * Specification: OBSERVABILITY.md §5/§7, TASKS.md T-OBS-002 (privacy allow-list) and T-SEC-004
 *   (token/code ban), ADR-0006 (opaque tokens), ADR-0019 (JSON logs to stdout).
 *
 * Two lists, deliberately held differently:
 *   - the ALLOW-LIST is a TypeScript const tuple, so a typo in an attribute name is a compile error and
 *     the `AllowedAttribute` union stays literal. Adding a name is a privacy decision, so it is reviewed.
 *   - the BAN-LIST is data (`banned-attributes.json`) because a build-time lint rule in `ops/eslint`
 *     cannot import TypeScript. Both the runtime guard and `majelishub/no-token-logging` read that one
 *     file, which is exactly the invariant T-SEC-004 requires ("the ban list is data-driven and shared
 *     with the runtime guard, so the two cannot drift").
 *
 * Matching splits the name into words on camelCase, snake_case and kebab-case boundaries and compares each
 * word with a pattern, with explicit exceptions and the allow-list checked first. Word matching rather
 * than substring matching is deliberate: a substring rule for `uri` bans `favourite` and `security`, and a
 * rule people have to disable is a rule that protects nothing. `ops/eslint/no-token-logging.mjs` applies
 * the identical rule to the same file, and
 * `tests/unit/observability/token-logging.test.ts` asserts the two agree on a fixture list.
 */
import bannedAttributes from "./banned-attributes.json";

/**
 * Names a log line may carry. Everything else is dropped, counted in
 * `telemetry_dropped_attribute_total` and reported (OBSERVABILITY.md §7).
 */
export const ALLOWED_ATTRIBUTES = [
  // correlation (OBSERVABILITY.md §3)
  "requestId", "traceId", "causationId", "service", "route",
  // opaque domain ids - the join keys between product dashboards and telemetry
  "organizationId", "mosqueId", "eventId", "registrationId", "attendanceId", "sessionId", "deviceId",
  "entranceId", "assetId", "chunkSessionId", "transcriptId", "intentId", "speakerId",
  // jobs
  "jobId", "jobKey", "queue", "attempt",
  // low-cardinality enum dimensions (OBSERVABILITY.md §4)
  "result", "outcome", "method", "channel", "kind", "operation", "stage", "status", "errorCode",
  "errorName", "policyKey", "templateKey", "providerId", "slo", "action", "permissionKey", "actorUserId",
  // numbers only - no free text anywhere
  "durationMs", "durationS", "sizeBytes", "bytes", "sequence", "chunkCount", "gapCount",
  "rowsAffected", "deletedCount", "capacityRemaining", "changedSegments", "revisionNumber",
  "occurrences", "droppedAttributes",
  // the guardrail report itself (which attribute was refused, and why)
  "attribute",
  // booleans
  "duplicate", "cacheHit", "dryRun", "degraded",
] as const;

export type AllowedAttribute = (typeof ALLOWED_ATTRIBUTES)[number];
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogAttributes = Partial<Record<AllowedAttribute, string | number | boolean>>;

/** A name that may never be logged, with the reason it is banned. */
export interface BannedAttributePattern {
  readonly match: string;
  readonly reason: string;
  readonly except?: readonly string[];
}

/** The ban list, as data, shared with `ops/eslint/no-token-logging.mjs`. */
export const BANNED_ATTRIBUTE_PATTERNS: readonly BannedAttributePattern[] = bannedAttributes.banned;

const allowedSet = new Set<string>(ALLOWED_ATTRIBUTES.map((name) => name.toLowerCase()));

/**
 * Splits an identifier into lowercase words: `checkinToken` -> [checkin, token],
 * `invitation_code` -> [invitation, code], `presigned-url` -> [presigned, url].
 *
 * Digits stay attached to the preceding word (`attempt2` -> [attempt2]) so a numbered field is not
 * accidentally split into a banned word.
 */
export function identifierWords(name: string): readonly string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1\u0000$2")
    .split(/[\u0000_\-\s.]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase());
}

// Startup assertion: an exception carved out of a ban pattern must be an allowed name, otherwise the
// JSON and the allow-list have drifted and the guard would silently permit a banned field.
for (const pattern of BANNED_ATTRIBUTE_PATTERNS) {
  for (const exception of pattern.except ?? []) {
    if (!allowedSet.has(exception.toLowerCase())) {
      throw new Error(
        `Telemetry ban list exception "${exception}" (pattern "${pattern.match}") is not in ALLOWED_ATTRIBUTES`,
      );
    }
  }
}

/** True when the name is on the allow-list. */
export function isAllowedAttributeName(name: string): boolean {
  return allowedSet.has(name.toLowerCase());
}

/**
 * The reason a name is banned, or `undefined` when it is not.
 *
 * Order matters: allow-list first (so `errorCode` and `transcriptId` pass), then the exceptions declared
 * on a pattern, then substring matching.
 */
export function bannedReasonFor(name: string): string | undefined {
  if (isAllowedAttributeName(name)) return undefined;
  const lower = name.toLowerCase();
  const words = identifierWords(name);
  for (const pattern of BANNED_ATTRIBUTE_PATTERNS) {
    if ((pattern.except ?? []).some((exception) => exception.toLowerCase() === lower)) continue;
    if (words.includes(pattern.match) || lower === pattern.match) return pattern.reason;
  }
  return undefined;
}

/** True when the name may never appear in telemetry, whatever the context. */
export function isBannedAttributeName(name: string): boolean {
  return bannedReasonFor(name) !== undefined;
}

/**
 * Every name in `names` that may not be logged, as `name -> reason`.
 *
 * The reason is safe to log; the VALUE never is. Used by the logger (drop, count, report) and by the
 * error serializer (strip).
 */
export function rejectedAttributes(names: Iterable<string>): ReadonlyMap<string, string> {
  const rejected = new Map<string, string>();
  for (const name of names) {
    if (isAllowedAttributeName(name)) continue;
    rejected.set(name, bannedReasonFor(name) ?? "not on the telemetry allow-list (OBSERVABILITY.md §7)");
  }
  return rejected;
}
