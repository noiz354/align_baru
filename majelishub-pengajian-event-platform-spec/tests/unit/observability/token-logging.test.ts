/**
 * UNIT TEST - observability/token-logging.test.ts
 * Layer: unit · Owning task: T-SEC-004 · Requirement(s): NFR-PRIV-006, NFR-SEC-004
 * Specification: ADR-0006 enforcement, OBSERVABILITY.md §7, docs/security/QR-SECURITY.md, TASKS.md T-SEC-004
 *
 * Why these behaviours: tokens and codes are credentials; logging them is an incident (THREAT_MODEL T-18).
 *
 * The rule is linted with the repository's own `eslint.config.mjs`, and the runtime guard is exercised
 * directly - the last test is the one that matters most: both read the same ban list, so the build-time
 * gate and the runtime guard cannot drift.
 *
 * Delivered 2026-09-27 (T-SEC-004).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Linter, type Linter as LinterTypes } from "eslint";
import { join } from "node:path";
import config from "../../../eslint.config.mjs";
import { majelishubPlugin } from "../../../ops/eslint/index.mjs";
import { resetBanListCache } from "../../../ops/eslint/no-token-logging.mjs";
import { createLogger, setLogSink, serializeErrorForTelemetry } from "@/shared/observability/logger";
import {
  ALLOWED_ATTRIBUTES,
  BANNED_ATTRIBUTE_PATTERNS,
  bannedReasonFor,
  identifierWords,
} from "@/shared/observability/attributes";
import bannedAttributes from "@/shared/observability/banned-attributes.json";

const linter = new Linter({ configType: "flat" });

function noTokenLogging(code: string, path = "src/server/checkin/validate.ts"): LinterTypes.LintMessage[] {
  return linter
    .verify(code, config, { filename: join(process.cwd(), path) })
    .filter((message) => message.ruleId === "majelishub/no-token-logging");
}

let lines: Record<string, unknown>[] = [];
let restoreSink: (() => void) | undefined;

beforeEach(() => {
  lines = [];
  const previous = setLogSink((line) => {
    lines.push(JSON.parse(line) as Record<string, unknown>);
  });
  restoreSink = () => setLogSink(previous);
});

afterEach(() => {
  restoreSink?.();
});

describe("token logging ban", () => {
  test("flags a logging call referencing a token or code field", () => {
    const cases: { code: string; messageId: string }[] = [
      {
        code: 'logger.info("checkin.validated", { token: checkinToken });',
        messageId: "bannedField",
      },
      {
        code: 'logger.info("checkin.validated", { invitation_code: invitationCode });',
        messageId: "bannedField",
      },
      {
        code: 'logger.info("recording.chunk.upload", { presignedUrl: signedUrl });',
        messageId: "bannedField",
      },
      {
        // An allowed key does not launder a banned value.
        code: 'logger.info("checkin.validated", { result: shortCode });',
        messageId: "bannedValue",
      },
      {
        code: 'logger.info("checkin.validated", { result: request.query.code });',
        messageId: "bannedValue",
      },
      {
        // Interpolation is how a value ends up in the message itself.
        code: 'logger.info(`checkin.validated ${checkinToken}`);',
        messageId: "interpolatedMessage",
      },
      {
        code: 'logger.info("checkin.validated " + checkinToken);',
        messageId: "nonLiteralMessage",
      },
    ];

    for (const { code, messageId } of cases) {
      const messages = noTokenLogging(code);
      expect(messages, code).not.toHaveLength(0);
      expect(messages[0]?.messageId, code).toBe(messageId);
      expect(messages[0]?.message, code).toContain("T-SEC-004");
    }
  });

  test("does not flag the allow-listed names that contain a banned word", () => {
    for (const code of [
      'logger.info("checkin.validated", { errorCode: "INVALID_TOKEN", result: "INVALID_TOKEN" });',
      'logger.info("transcript.revision.save", { transcriptId: id, revisionNumber: 3 });',
      'logger.info("checkin.validated", { errorName: "AppError", eventId: id });',
      // `security` and `favourite` contain the letters of banned patterns but are not banned words -
      // word matching, not substring matching, is what keeps this rule usable.
      'logger.info("checkin.validated", { result: securityCheckOutcome, kind: favouriteMethod });',
    ]) {
      expect(noTokenLogging(code), code).toEqual([]);
    }
  });

  test("strips token-named attributes at runtime", () => {
    const logger = createLogger("checkin");

    logger.info("checkin.validated", {
      result: "VALID",
      // Both are refused: the first is on the ban list, the second is simply not allow-listed.
      ...({ checkinToken: "tok_live_abc123", shortCode: "KJ7QP2" } as object),
    });

    const line = lines[0]!;
    expect(line).toMatchObject({ msg: "checkin.validated", result: "VALID" });
    expect(line).not.toHaveProperty("checkinToken");
    expect(line).not.toHaveProperty("shortCode");

    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("tok_live_abc123");
    expect(serialized).not.toContain("KJ7QP2");

    // The rejection is visible: the guardrail counter is incremented for a banned name.
    const report = lines.find((entry) => entry["msg"] === "telemetry.dropped_attribute");
    expect(report).toBeDefined();
    expect(report!["kind"]).toBe("banned");
    expect(report!["attribute"]).toBe("checkinToken");
  });

  test("omits token fields from serialised errors", () => {
    const error = Object.assign(new Error("invitation rejected"), {
      name: "InvitationError",
      code: "VALIDATION_FAILED",
      invitationCode: "ABC-123",
      checkinToken: "tok_live_abc123",
      participantEmail: "someone@example.org",
      presignedUrl: "https://storage.example/x?sig=1",
      result: "REJECTED",
    });

    const serialized = serializeErrorForTelemetry(error);
    const asJson = JSON.stringify(serialized);

    expect(serialized).toMatchObject({ errorName: "InvitationError", errorCode: "VALIDATION_FAILED" });
    for (const banned of ["invitationCode", "checkinToken", "participantEmail", "presignedUrl"]) {
      expect(serialized, banned).not.toHaveProperty(banned);
    }
    for (const value of ["ABC-123", "tok_live_abc123", "someone@example.org", "sig=1"]) {
      expect(asJson, value).not.toContain(value);
    }
    // The error message quotes the submitted value, so it never reaches telemetry either.
    expect(asJson).not.toContain("invitation rejected");
    expect(serialized["result"]).toBe("REJECTED");
  });

  test("shares one ban list between the lint rule and the runtime guard", () => {
    // Both sides read this file; if either stops reading it, this test is the alarm.
    expect(BANNED_ATTRIBUTE_PATTERNS).toBe(bannedAttributes.banned);
    expect(bannedAttributes.matchMode).toBe("identifier-word");

    const fixtures = [
      "checkinToken", "invitation_code", "presignedUrl", "shortCode", "participantEmail", "contactHash",
      "clientIp", "ip_address", "transcriptText", "feedbackBody", "audioBytes", "errorMessage", "query",
      "personName", "deviceLocation",
      // Not banned:
      "errorCode", "errorName", "transcriptId", "eventId", "result", "durationMs", "securityCheck",
      "favouriteMethod", "attempt2", "policyKey",
    ];

    for (const name of fixtures) {
      const runtime = bannedReasonFor(name);
      const lint = noTokenLogging(`logger.info("checkin.validated", { ${name}: value });`);
      if (runtime === undefined) {
        expect(lint, `${name} should be allowed by both`).toEqual([]);
      } else {
        expect(lint, `${name} should be banned by both (${runtime})`).not.toEqual([]);
      }
    }

    // Every allow-listed name survives the ban list, otherwise the allow-list is unreachable.
    for (const name of ALLOWED_ATTRIBUTES) {
      expect(bannedReasonFor(name), `${name} is allow-listed but banned`).toBeUndefined();
    }

    // The word splitter both implementations rely on.
    expect(identifierWords("checkinToken")).toEqual(["checkin", "token"]);
    expect(identifierWords("invitation_code")).toEqual(["invitation", "code"]);
    expect(identifierWords("presigned-url")).toEqual(["presigned", "url"]);
    expect(identifierWords("attempt2")).toEqual(["attempt2"]);
  });

  test("reports an unreadable ban list instead of passing silently", () => {
    // A rule that cannot read the ban list must say so, not report a clean file: a broken environment has
    // to look broken (same shape as `no-fake-implementation`).
    resetBanListCache();
    // The plugin's hand-written type surface (ops/eslint/index.d.mts) is deliberately opaque, so the
    // one-off config is cast to what `Linter.verify` accepts.
    const brokenBanListConfig = [
      {
        files: ["**/*.ts"],
        plugins: { majelishub: majelishubPlugin },
        rules: {
          "majelishub/no-token-logging": ["error", { banListPath: "src/shared/observability/missing.json" }],
        },
      },
    ] as unknown as Parameters<typeof linter.verify>[1];

    const messages = linter
      .verify('logger.info("checkin.validated", { token: value });', brokenBanListConfig, {
        filename: join(process.cwd(), "src/server/checkin/validate.ts"),
      })
      .filter((message) => message.ruleId === "majelishub/no-token-logging");
    resetBanListCache();

    expect(messages).toHaveLength(1);
    expect(messages[0]?.messageId).toBe("banListUnreadable");
    expect(messages[0]?.message).toContain("missing.json");
  });
});
