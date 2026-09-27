/**
 * The only logging interface in the product.
 *
 * Where this belongs: shared/observability (used by every layer).
 * Specification: OBSERVABILITY.md §3/§5/§7, ADR-0019 (JSON logs to stdout, no OTel logs SDK),
 *   TASKS.md T-OBS-002 (privacy allow-list) and T-SEC-004 (token ban), THREAT_MODEL T-18.
 *
 * Invariants, all enforced here rather than by review:
 *   1. Attribute names come from ALLOWED_ATTRIBUTES; anything else is dropped, counted in
 *      `telemetry_dropped_attribute_total` and reported by name - visible, never silent.
 *   2. Banned names (tokens, codes, contacts, content, presigned URLs, raw IPs) are dropped for the
 *      reason recorded in `banned-attributes.json`, which the `majelishub/no-token-logging` lint rule
 *      reads from the same file.
 *   3. No free text: the event name must be a dotted lowercase identifier (`checkin.committed`), and
 *      attribute values must be string/number/boolean without whitespace. A message built by
 *      interpolation is rejected, so "logged the value" cannot happen by accident.
 *   4. Errors contribute `errorCode`/`errorName` and - server-side only - a stack. The error's own
 *      `message` is never logged, because that is where the invalid input value usually is
 *      (OBSERVABILITY.md §5 rule 3).
 *   5. A log call never throws: telemetry must not break the product. A sink that fails is reported once
 *      on stdout and counted, and the call returns.
 *
 * `console.*` is banned outside `src/server/bootstrap/**` by the `no-console` rule, so this module is the
 * only way to produce a log line.
 */
import {
  ALLOWED_ATTRIBUTES,
  isAllowedAttributeName,
  isBannedAttributeName,
  rejectedAttributes,
  type AllowedAttribute,
  type LogAttributes,
  type LogLevel,
} from "@/shared/observability/attributes";
import { recordDroppedAttribute } from "@/shared/observability/metrics";

export { ALLOWED_ATTRIBUTES, type AllowedAttribute, type LogAttributes, type LogLevel };
export {
  BANNED_ATTRIBUTE_PATTERNS,
  bannedReasonFor,
  isBannedAttributeName,
  rejectedAttributes,
} from "@/shared/observability/attributes";

/**
 * A dotted lowercase identifier. Anything else is treated as free text and refused: a message assembled
 * by interpolation is exactly how a token ends up in a log line.
 */
const EVENT_NAME = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
const MAX_EVENT_NAME_LENGTH = 64;
/** Attribute values are identifiers, enum values and numbers - never sentences. */
const MAX_ATTRIBUTE_VALUE_LENGTH = 128;

/** Where a finished line goes. Injectable so tests can capture output instead of parsing stdout. */
export interface LogSink {
  (line: string): void;
}

const defaultSink: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

let sink: LogSink = defaultSink;

/** Registers a log sink. Returns the previous one so a caller (or a test) can restore it. */
export function setLogSink(next: LogSink): LogSink {
  const previous = sink;
  sink = next;
  return previous;
}

export interface LoggerOptions {
  /** Attach `error.stack`. Defaults to true on the server, false in the browser (OBSERVABILITY.md §5). */
  readonly includeStack?: boolean;
}

export interface Logger {
  debug(event: string, attributes?: LogAttributes): void;
  info(event: string, attributes?: LogAttributes): void;
  warn(event: string, attributes?: LogAttributes): void;
  error(event: string, attributes?: LogAttributes, error?: unknown): void;
  child(bindings: LogAttributes): Logger;
}

/** What a dropped attribute looks like in the report: the NAME and the reason, never the value. */
interface Dropped {
  readonly name: string;
  readonly reason: string;
  /** Why it was dropped - the label on `telemetry_dropped_attribute_total`. */
  readonly kind: "banned" | "unknown" | "invalidValue" | "invalidEvent";
}

function sanitize(
  attributes: LogAttributes | undefined,
  dropped: Dropped[],
): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  if (!attributes) return clean;

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) continue;

    if (!isAllowedAttributeName(name)) {
      const reason = [...rejectedAttributes([name]).values()][0] ?? "not on the telemetry allow-list";
      // A banned name is reported as `banned` so the guardrail counter can distinguish "somebody tried to
      // log a token" from "somebody misspelt an attribute".
      dropped.push({ name, reason, kind: isBannedAttributeName(name) ? "banned" : "unknown" });
      continue;
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      dropped.push({
        name,
        reason: "attribute values must be string, number or boolean - no payloads",
        kind: "invalidValue",
      });
      continue;
    }
    if (typeof value === "string" && (value.length > MAX_ATTRIBUTE_VALUE_LENGTH || /\s/.test(value))) {
      dropped.push({
        name,
        reason: "attribute values carry identifiers and enums, not free text",
        kind: "invalidValue",
      });
      continue;
    }
    clean[name] = value;
  }
  return clean;
}

/**
 * Reduces an error to what telemetry may carry.
 *
 * The `message` is deliberately absent: it is where validation errors quote the submitted value, and a
 * token or an email in a message would be a privacy incident (T-18). Callers that need to distinguish
 * cases log `errorCode`, which is an opaque enum from `src/shared/contracts/errors.ts`. Any own property
 * whose name matches the ban list is stripped, so a hand-rolled error object cannot smuggle a token.
 */
export function serializeErrorForTelemetry(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return { errorName: typeof error === "string" ? "StringError" : "UnknownError" };

  const serialized: Record<string, string> = { errorName: error.name };
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.length <= MAX_ATTRIBUTE_VALUE_LENGTH) serialized["errorCode"] = code;

  for (const [name, value] of Object.entries(error)) {
    if (name === "message" || name === "stack" || name === "name" || name === "code") continue;
    if (rejectedAttributes([name]).size > 0) continue;
    if (typeof value === "string" && value.length <= MAX_ATTRIBUTE_VALUE_LENGTH && !/\s/.test(value)) {
      serialized[name] = value;
    }
  }
  return serialized;
}

function reportDropped(service: string, dropped: readonly Dropped[]): void {
  if (dropped.length === 0) return;
  for (const entry of dropped) recordDroppedAttribute(entry.kind);

  // The name and the reason are safe to publish; the value is not, so it is never part of this line.
  write({
    level: "warn",
    msg: "telemetry.dropped_attribute",
    service,
    // One line per rejection would flood a hot path, so the names are summarised as a count plus the
    // first offending name and reason, which is what an operator needs to find the call site.
    droppedAttributes: dropped.length,
    attribute: dropped[0]!.name,
    kind: dropped[0]!.kind,
    outcome: "DROPPED",
  });
}

function write(fields: Record<string, unknown>): void {
  try {
    sink(JSON.stringify({ time: new Date().toISOString(), ...fields }));
  } catch {
    // The sink is unreachable (a closed stdout, a throwing test double). Telemetry never breaks the
    // product, so the failure is reported once, in the smallest possible shape, and swallowed.
    try {
      defaultSink(JSON.stringify({ level: "warn", msg: "telemetry.log_sink_failed", time: new Date().toISOString() }));
    } catch {
      // Nothing left to report with; failing here would take the request down.
    }
  }
}

/**
 * Creates a logger for one service.
 *
 * @param service short service name, e.g. `"checkin"` - it appears on every line as `service`
 * @param options `includeStack` defaults to true on the server, false in the browser
 */
export function createLogger(service: string, options: LoggerOptions = {}): Logger {
  return loggerWith(service, {}, options);
}

function loggerWith(
  service: string,
  bindings: Readonly<Record<string, string | number | boolean>>,
  options: LoggerOptions,
): Logger {
  const includeStack = options.includeStack ?? typeof window === "undefined";

  function emit(level: LogLevel, event: string, attributes?: LogAttributes, error?: unknown): void {
    const dropped: Dropped[] = [];
    const own = sanitize(attributes, dropped);

    // Bindings were validated when the child was created, so they are merged without re-checking.
    const fields: Record<string, unknown> = { level, service, ...bindings, ...own };

    if (!EVENT_NAME.test(event) || event.length > MAX_EVENT_NAME_LENGTH) {
      // The rejected name is not logged: it may be interpolated free text.
      dropped.push({
        name: event,
        reason: "event names are dotted identifiers, not free text",
        kind: "invalidEvent",
      });
      fields["msg"] = "telemetry.invalid_event";
      fields["outcome"] = "REJECTED";
    } else {
      fields["msg"] = event;
    }

    if (error !== undefined) {
      Object.assign(fields, serializeErrorForTelemetry(error));
      if (includeStack && error instanceof Error && error.stack) {
        fields["stack"] = error.stack;
      }
    }

    write(fields);
    reportDropped(service, dropped);
  }

  return {
    debug: (event, attributes) => emit("debug", event, attributes),
    info: (event, attributes) => emit("info", event, attributes),
    warn: (event, attributes) => emit("warn", event, attributes),
    error: (event, attributes, error) => emit("error", event, attributes, error),
    child(childBindings: LogAttributes): Logger {
      const dropped: Dropped[] = [];
      const own = sanitize(childBindings, dropped);
      reportDropped(service, dropped);
      // A child carries its own copy: mutating the parent's bindings would leak one request's
      // correlation ids into every other request that shares the parent logger.
      return loggerWith(service, { ...bindings, ...own }, options);
    },
  };
}
