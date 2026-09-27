/**
 * UNIT TEST - observability/logger.test.ts
 * Layer: unit · Owning task: T-OBS-002 · Requirement(s): NFR-OBS-002, NFR-OBS-001, NFR-PRIV-006
 * Specification: OBSERVABILITY.md §3/§5/§7, ADR-0019
 *
 * Why these behaviours: the allow-list is what makes the telemetry privacy rules enforceable instead of
 * aspirational, and a violation must be visible rather than silent.
 *
 * Delivered 2026-09-27 (T-OBS-002).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createLogger, setLogSink, serializeErrorForTelemetry } from "@/shared/observability/logger";
import { metricsSnapshot, resetMetrics } from "@/shared/observability/metrics";
import { AppError } from "@/shared/contracts/errors";

let lines: Record<string, unknown>[] = [];
let restoreSink: (() => void) | undefined;

function capturedLine(index = 0): Record<string, unknown> {
  const line = lines[index];
  if (!line) throw new Error(`no log line at index ${index}; captured ${lines.length}`);
  return line;
}

beforeEach(() => {
  lines = [];
  resetMetrics();
  const previous = setLogSink((line) => {
    lines.push(JSON.parse(line) as Record<string, unknown>);
  });
  restoreSink = () => setLogSink(previous);
});

afterEach(() => {
  restoreSink?.();
  resetMetrics();
});

function droppedCount(): number {
  let total = 0;
  for (const [key, value] of metricsSnapshot()) {
    if (key.startsWith("telemetry_dropped_attribute_total")) total += value;
  }
  return total;
}

describe("logger allow-list", () => {
  test("drops unknown attributes and increments the dropped-attribute counter", () => {
    const logger = createLogger("checkin");

    logger.info("checkin.validated", {
      eventId: "55555555-5555-7555-8555-555555555555",
      // Neither name is on the allow-list; the second is also on the ban list.
      ...({ favouriteColour: "green", participantEmail: "someone@example.org" } as object),
    });

    const line = capturedLine();
    expect(line["eventId"]).toBe("55555555-5555-7555-8555-555555555555");
    expect(line).not.toHaveProperty("favouriteColour");
    expect(line).not.toHaveProperty("participantEmail");

    // Two attributes dropped, and the counter can tell an unknown name from a banned one.
    expect(droppedCount()).toBe(2);
    expect(metricsSnapshot().get('telemetry_dropped_attribute_total{kind=unknown}')).toBe(1);
    expect(metricsSnapshot().get('telemetry_dropped_attribute_total{kind=banned}')).toBe(1);

    // The rejection is reported by name - never by value.
    const report = lines.find((entry) => entry["msg"] === "telemetry.dropped_attribute");
    expect(report).toBeDefined();
    expect(report!["droppedAttributes"]).toBe(2);
    expect(JSON.stringify(report)).not.toContain("someone@example.org");
  });

  test("refuses free-text fields and only accepts enum-like values", () => {
    const logger = createLogger("registration");

    // An interpolated message is how a value reaches a log line, so the event name itself is refused.
    const registrationId = "reg-1";
    // eslint-disable-next-line majelishub/no-token-logging -- the fixture IS the violation: the rule flags it at build time, the logger refuses it at runtime
    logger.info(`registration.created for ${registrationId}`, { result: "REGISTERED" });
    expect(capturedLine()["msg"]).toBe("telemetry.invalid_event");
    expect(capturedLine()["outcome"]).toBe("REJECTED");
    // The refused text is not echoed back - it could contain anything.
    expect(JSON.stringify(capturedLine())).not.toContain(registrationId);

    // A value with whitespace is a sentence, not an identifier or an enum.
    lines = [];
    logger.info("registration.created", { result: "REGISTERED", ...({ outcome: "seat 12 taken by Budi" } as object) });
    expect(capturedLine()["result"]).toBe("REGISTERED");
    expect(JSON.stringify(capturedLine())).not.toContain("Budi");

    // Objects are payloads, and payloads are never logged (OBSERVABILITY.md §5 rule 2).
    lines = [];
    logger.info("registration.created", { ...({ bytes: { nested: true } } as object) });
    expect(capturedLine()).not.toHaveProperty("bytes");
    expect(droppedCount()).toBeGreaterThan(0);
  });

  test("emits the documented fields for a check-in log line", () => {
    const logger = createLogger("checkin").child({ requestId: "01JCHECKINREQUEST", traceId: "trace-1" });

    logger.info("checkin.committed", {
      organizationId: "0a0a0a0a-0a0a-7a0a-8a0a-0a0a0a0a0a0a",
      eventId: "9f9f9f9f-9f9f-7f9f-8f9f-9f9f9f9f9f9f",
      attendanceId: "c1c1c1c1-c1c1-7c1c-8c1c-c1c1c1c1c1c1",
      result: "VALID",
      method: "QR",
      durationMs: 84,
    });

    expect(capturedLine()).toMatchObject({
      level: "info",
      msg: "checkin.committed",
      service: "checkin",
      requestId: "01JCHECKINREQUEST",
      traceId: "trace-1",
      organizationId: "0a0a0a0a-0a0a-7a0a-8a0a-0a0a0a0a0a0a",
      eventId: "9f9f9f9f-9f9f-7f9f-8f9f-9f9f9f9f9f9f",
      attendanceId: "c1c1c1c1-c1c1-7c1c-8c1c-c1c1c1c1c1c1",
      result: "VALID",
      method: "QR",
      durationMs: 84,
    });
    expect(typeof capturedLine()["time"]).toBe("string");

    // A child must not leak its bindings into its parent, or one request's correlation ids end up on
    // every other request's lines.
    const parent = createLogger("checkin");
    const scoped = parent.child({ requestId: "req-a" });
    lines = [];
    scoped.info("checkin.validated", { result: "VALID" });
    parent.info("checkin.validated", { result: "VALID" });
    expect(lines[0]).toMatchObject({ requestId: "req-a" });
    expect(lines[1]).not.toHaveProperty("requestId");

    // The DoD guardrail: a normal flow drops nothing.
    expect(droppedCount()).toBe(0);
  });

  test("keeps the application running when the exporter is unreachable", () => {
    const written: string[] = [];
    const stdout = process.stdout as unknown as { write: (chunk: string) => boolean };
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      written.push(chunk);
      return true;
    }) as typeof stdout.write;

    const failing = setLogSink(() => {
      throw new Error("exporter unreachable");
    });

    try {
      const logger = createLogger("checkin");
      // A log call must never throw: telemetry cannot take the product down (OBSERVABILITY.md §5).
      expect(() => logger.info("checkin.validated", { result: "VALID" })).not.toThrow();
      expect(() => logger.error("checkin.failed", { result: "ERROR" }, new Error("boom"))).not.toThrow();
      // The failure itself is reported once, on stdout, and does not carry the caller's attributes.
      expect(written.some((line) => line.includes("telemetry.log_sink_failed"))).toBe(true);
      expect(written.join("")).not.toContain("VALID");
    } finally {
      setLogSink(failing);
      stdout.write = originalWrite;
    }
  });

  test("logs the error code and never the error message", () => {
    const logger = createLogger("registration", { includeStack: false });
    const error = AppError.validation("Kode undangan tidak valid: RAHASIA-123");

    logger.error("registration.rejected", { result: "ERROR" }, error);

    const line = capturedLine();
    expect(line).toMatchObject({ level: "error", msg: "registration.rejected", errorName: "AppError", errorCode: "VALIDATION_FAILED" });
    // The message quotes the submitted value - that is exactly what must not reach telemetry.
    expect(JSON.stringify(line)).not.toContain("RAHASIA-123");
    expect(line).not.toHaveProperty("stack");
  });

  test("strips banned fields from a serialised error", () => {
    const error = Object.assign(new Error("nope"), {
      name: "ValidationError",
      code: "CHUNK_VALIDATION_FAILED",
      requestId: "01JREQ",
      checkinToken: "tok_live_123",
      invitationCode: "ABC123",
      contactHash: "deadbeef",
      outcome: "REJECTED",
    });

    const serialized = serializeErrorForTelemetry(error);

    expect(serialized).toMatchObject({ errorName: "ValidationError", errorCode: "CHUNK_VALIDATION_FAILED", requestId: "01JREQ" });
    expect(serialized).not.toHaveProperty("checkinToken");
    expect(serialized).not.toHaveProperty("invitationCode");
    expect(serialized).not.toHaveProperty("contactHash");
    expect(JSON.stringify(serialized)).not.toContain("tok_live_123");
  });
});
